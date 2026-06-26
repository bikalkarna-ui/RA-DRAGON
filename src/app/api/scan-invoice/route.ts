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
    if(!file)return NextResponse.json({error:'No file'},{status:400});
    const admin=createAdminClient();
    const filePath=`${store.id}/${crypto.randomUUID()}.${file.name.split('.').pop()||'pdf'}`;
    const buf=Buffer.from(await file.arrayBuffer());
    await admin.storage.from('invoices').upload(filePath,buf,{contentType:file.type});
    const apiKey=process.env.OPENROUTER_API_KEY;
    if(!apiKey)return NextResponse.json({error:'OPENROUTER_API_KEY not set'},{status:500});
    const b64=buf.toString('base64');
    const dataUrl=`data:${file.type};base64,${b64}`;
    const isPdf=file.type==='application/pdf';
    const prompt=`Extract invoice data. Return ONLY valid JSON (no markdown):
{"vendor_name":"string or null","vendor_company":"Pepsi/Coca-Cola/Frito-Lay/RNK/GG/McLane/Core-Mark or null","invoice_number":"string or null","invoice_date":"YYYY-MM-DD or null","total_amount":number or null,"line_items":[{"description":"product name","quantity":number,"unit_cost":number}]}`;
    const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages:[{role:'user',content:[{type:'text',text:prompt},isPdf?{type:'file',file:{filename:'invoice.pdf',file_data:dataUrl}}:{type:'image_url',image_url:{url:dataUrl}}]}]})});
    if(!res.ok){const txt=await res.text();return NextResponse.json({error:`AI failed (${res.status}): ${txt.slice(0,200)}`},{status:502});}
    const orData=await res.json();
    const content=orData?.choices?.[0]?.message?.content??'';
    let parsed:any;
    try{parsed=JSON.parse(content.replace(/^```json\s*|```\s*$/g,'').trim());}
    catch{return NextResponse.json({error:'AI returned invalid JSON'},{status:502});}
    const{data:existing}=await admin.from('products').select('id,name,unit_cost,unit_price,quantity').eq('store_id',store.id).eq('is_active',true);
    const lineItems=(parsed.line_items??[]).map((item:any)=>{
      const desc=(item.description??'').toLowerCase();
      const match=(existing??[]).find(p=>p.name.toLowerCase()===desc||desc.includes(p.name.toLowerCase())||p.name.toLowerCase().includes(desc));
      const cost=Number(item.unit_cost)||0;
      const oldCost=match?Number(match.unit_cost):null;
      return{raw_description:item.description??'Unknown',quantity:Number(item.quantity)||0,unit_cost:cost,old_cost:oldCost,line_total:Math.round((Number(item.quantity)||0)*cost*100)/100,product_id:match?.id??null,suggested_price:Math.round(cost*1.3*100)/100,old_price:match?Number(match.unit_price):null,price_changed:match&&oldCost!==null&&Math.abs(cost-oldCost)>0.001,is_new_product:!match,matched_name:match?.name??null,current_price:match?.unit_price??null,current_quantity:match?.quantity??null,action:match?'update':'create'};
    });
    const priceChanges=lineItems.filter((li:any)=>li.price_changed).length;
    const{data:invoice}=await admin.from('invoices').insert({store_id:store.id,vendor_name:parsed.vendor_name??null,vendor_company:parsed.vendor_company??null,invoice_number:parsed.invoice_number??null,invoice_date:parsed.invoice_date??null,total_amount:parsed.total_amount??null,file_path:filePath,status:'NEEDS_REVIEW',price_changes_count:priceChanges,raw_ai_response:parsed}).select('id').single();
    const{data:savedItems}=await admin.from('invoice_items').insert(lineItems.map((li:any)=>({invoice_id:invoice?.id,product_id:li.product_id,raw_description:li.raw_description,quantity:li.quantity,unit_cost:li.unit_cost,old_cost:li.old_cost,line_total:li.line_total,suggested_price:li.suggested_price,old_price:li.old_price,price_changed:li.price_changed??false,match_confidence:li.matched_name?0.9:null,is_new_product:li.is_new_product,action:li.action}))).select('*');
    return NextResponse.json({invoice:{id:invoice?.id,vendor_name:parsed.vendor_name,vendor_company:parsed.vendor_company,invoice_number:parsed.invoice_number,total_amount:parsed.total_amount,status:'NEEDS_REVIEW',price_changes_count:priceChanges},items:(savedItems??[]).map((s:any,i:number)=>({...s,matched_name:lineItems[i].matched_name,current_price:lineItems[i].current_price,current_quantity:lineItems[i].current_quantity}))});
  }catch(err:any){return NextResponse.json({error:err.message},{status:500});}
}
