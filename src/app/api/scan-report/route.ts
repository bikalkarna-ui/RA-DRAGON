import {NextRequest,NextResponse} from 'next/server';
import {createClient,createAdminClient} from '@/lib/supabase/server';

const MODEL='anthropic/claude-sonnet-4.6';

export async function POST(request:NextRequest){
  try{
    const sb=createClient();
    const{data:{user}}=await sb.auth.getUser();
    if(!user)return NextResponse.json({error:'Not authenticated'},{status:401});
    const{data:store}=await sb.from('stores').select('id').eq('owner_id',user.id).maybeSingle();
    if(!store)return NextResponse.json({error:'No store'},{status:400});

    const formData=await request.formData();
    const file=formData.get('file') as File|null;
    if(!file)return NextResponse.json({error:'No file uploaded'},{status:400});

    const admin=createAdminClient();
    const ext=file.name.split('.').pop()||'pdf';
    const filePath=`${store.id}/reports/${crypto.randomUUID()}.${ext}`;
    const buf=Buffer.from(await file.arrayBuffer());
    await admin.storage.from('reports').upload(filePath,buf,{contentType:file.type});

    const apiKey=process.env.OPENROUTER_API_KEY;
    if(!apiKey)return NextResponse.json({error:'OpenRouter API key not configured'},{status:500});

    const b64=buf.toString('base64');
    const dataUrl=`data:${file.type};base64,${b64}`;
    const isPdf=file.type==='application/pdf';

    const prompt=`This is a Modisoft or convenience store register daily sales report. Extract all sales data and return ONLY valid JSON (no markdown):
{
  "report_date": "YYYY-MM-DD or null",
  "gross_sales": number or null,
  "net_sales": number or null,
  "cash_sales": number or null,
  "card_sales": number or null,
  "tax_collected": number or null,
  "transaction_count": number or null,
  "top_categories": [
    {"name": "category name", "sales": number, "units": number}
  ],
  "top_products": [
    {"name": "product name", "sales": number, "units": number}
  ],
  "hourly_breakdown": [
    {"hour": "9am", "sales": number}
  ],
  "payment_methods": [
    {"method": "Cash", "amount": number}
  ],
  "notes": "any other relevant info extracted"
}
Extract as many line items as you can see. If a field is not visible, use null.`;

    const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
      method:'POST',
      headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','HTTP-Referer':'https://ra-solution.app'},
      body:JSON.stringify({
        model:MODEL,
        messages:[{role:'user',content:[
          {type:'text',text:prompt},
          isPdf?{type:'file',file:{filename:'report.pdf',file_data:dataUrl}}:{type:'image_url',image_url:{url:dataUrl}},
        ]}],
      }),
    });

    if(!res.ok){
      const txt=await res.text();
      return NextResponse.json({error:`AI failed (${res.status}): ${txt.slice(0,300)}`},{status:502});
    }

    const orData=await res.json();
    const content=orData?.choices?.[0]?.message?.content??'';
    let parsed:any;
    try{parsed=JSON.parse(content.replace(/^```json\s*|```\s*$/g,'').trim());}
    catch{return NextResponse.json({error:'AI returned invalid JSON. Please try again.'},{status:502});}

    // Save to register_syncs
    const{data:syncRecord}=await admin.from('register_syncs').insert({
      store_id:store.id,
      sync_date:parsed.report_date??new Date().toISOString().split('T')[0],
      source:'modisoft',
      file_path:filePath,
      status:'completed',
      raw_ai_response:parsed,
      gross_sales:parsed.gross_sales,
      net_sales:parsed.net_sales,
      cash_sales:parsed.cash_sales,
      card_sales:parsed.card_sales,
      tax_collected:parsed.tax_collected,
      transaction_count:parsed.transaction_count,
      top_categories:parsed.top_categories??[],
      top_products:parsed.top_products??[],
    }).select('id').single();

    // Also create sales records for dashboard tracking
    if(parsed.gross_sales&&syncRecord){
      const{data:saleRecord}=await admin.from('sales').insert({
        store_id:store.id,
        subtotal:parsed.net_sales??parsed.gross_sales,
        tax:parsed.tax_collected??0,
        total:parsed.gross_sales,
        payment_method:'modisoft_sync',
        source:'modisoft_sync',
      }).select('id').single();

      // Insert top products as sale items for analytics
      if(saleRecord&&parsed.top_products?.length){
        await admin.from('sale_items').insert(
          parsed.top_products.slice(0,20).map((p:any)=>({
            sale_id:saleRecord.id,
            product_name:p.name,
            quantity:p.units??1,
            unit_price:p.units>0?(p.sales/p.units):p.sales,
            unit_cost:0,
            taxable:false,
            line_total:p.sales??0,
          }))
        );
      }
    }

    return NextResponse.json({
      success:true,
      syncId:syncRecord?.id,
      data:parsed,
    });
  }catch(err:any){
    console.error(err);
    return NextResponse.json({error:err.message??'Unexpected error'},{status:500});
  }
}
