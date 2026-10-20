import Link from 'next/link'

export function RankingChart({title,rows}:{title:string;rows:{label:string;count:number;href?:string}[]}) {
  const max=Math.max(1,...rows.map(row=>row.count))
  return <section className="nic-analytics__card"><h3>{title}</h3>{!rows.length&&<p className="nic-analytics__muted">No recorded activity in this date range.</p>}{rows.map((row,index)=>{
    const content=<><span className="nic-ranking__label">{row.label}</span><b>{row.count.toLocaleString('en-US')}</b><span className="nic-ranking__track"><span style={{width:`${row.count/max*100}%`}}/></span></>
    return row.href?<Link key={index} className="nic-ranking" href={row.href}>{content}</Link>:<div key={index} className="nic-ranking">{content}</div>
  })}</section>
}
