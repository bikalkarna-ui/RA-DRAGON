import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
const MODEL='anthropic/claude-sonnet-4-5';
export async function POST(request:NextRequest){
  try{
    const sb=createClient();
    const{data:{user}}=await sb.auth.getUser();
    if(!user)return NextResponse.json({error:'Not authenticated'},{status:401});
    const{data:store}=await sb.from('stores').select('id').eq('owner_id',user.id).maybeSingle();
    if(!store)return NextResponse.json({error:'No store'},{status:400});
    const{vendorId,vendorName}=await request.json();
    
    const{data:products}=await sb.from('products').select('id,name,sku,unit_cost,unit_price,quantity,min_quantity,max_quantity,vendor_company').eq('store_id',store.id).eq('is_active',true).eq('vendor_company',vendorName);
    if(!products?.length)return NextResponse.json({error:`No products assigned to ${vendorName}. Go to Inventory and set the vendor company for each product.`},{status:400});
    const ids=products.map(p=>p.id);
    const ago=new Date(Date.now()-30*24*60*60*1000).toISOString();
    const{data:salesData}=await sb.from('sale_items').select('product_id,quantity,line_total').in('product_id',ids).gte('created_at',ago);
    const vel=new Map<string,{qty:number;rev:number}>();
    for(const s of salesData??[]){const c=vel.get(s.product_id)??{qty:0,rev:0};vel.set(s.product_id,{qty:c.qty+Number(s.quantity),rev:c.rev+Number(s.line_total)});}
    const summary=products.map(p=>({id:p.id,name:p.name,sku:p.sku,currentStock:p.quantity,minQty:p.min_quantity,maxQty:p.max_quantity??100,unitCost:p.unit_cost,sold30Days:vel.get(p.id)?.qty??0}));
    const apiKey=process.env.OPENROUTER_API_KEY;
    let orderItems:any[];
    let reasoning='Rule-based: ordering items below minimum stock level.';
    if(apiKey){
      const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages:[{role:'user',content:`Generate reorder list for vendor ${vendorName}. Products: ${JSON.stringify(summary)}. Return JSON only: {"reasoning":"string","items":[{"product_id":"uuid","product_name":"name","sku":"or null","current_stock":number,"suggested_qty":number,"unit_cost":number,"reason":"why"}]}`}]})});
      if(res.ok){const d=await res.json();const c=d?.choices?.[0]?.message?.content??'';try{const p=JSON.parse(c.replace(/^```json\s*|```\s*$/g,'').trim());orderItems=p.items.map((i:any)=>({...i,line_total:Number(i.suggested_qty)*Number(i.unit_cost)}));reasoning=p.reasoning;}catch{orderItems=summary.filter(p=>p.currentStock<=p.minQty).map(p=>({product_id:p.id,product_name:p.name,sku:p.sku??null,current_stock:p.currentStock,suggested_qty:Math.max(p.minQty*2,Math.ceil(p.sold30Days/2)),unit_cost:p.unitCost,line_total:Math.max(p.minQty*2,Math.ceil(p.sold30Days/2))*p.unitCost,reason:'Below minimum'}));}}}
    else{orderItems=summary.filter(p=>p.currentStock<=p.minQty).map(p=>({product_id:p.id,product_name:p.name,sku:p.sku??null,current_stock:p.currentStock,suggested_qty:Math.max(p.minQty*2,10),unit_cost:p.unitCost,line_total:Math.max(p.minQty*2,10)*p.unitCost,reason:'Below minimum stock'}));}
    const total=orderItems!.reduce((s:number,i:any)=>s+Number(i.line_total),0);
    const{data:order}=await sb.from('vendor_orders').insert({store_id:store.id,vendor_id:vendorId??null,vendor_name:vendorName,status:'draft',ai_generated:!!apiKey,ai_reasoning:reasoning,total_estimated:total}).select('id').single();
    if(order&&orderItems!.length)await sb.from('vendor_order_items').insert(orderItems!.map((i:any)=>({order_id:order.id,product_id:i.product_id,product_name:i.product_name,sku:i.sku??null,current_stock:i.current_stock,suggested_qty:i.suggested_qty,unit_cost:i.unit_cost,line_total:i.line_total,reason:i.reason})));
    return NextResponse.json({orderId:order?.id,itemCount:orderItems!.length,total,reasoning});
  }catch(err:any){return NextResponse.json({error:err.message},{status:500});}
}
