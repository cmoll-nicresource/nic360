'use client'

import React, { useId, useState } from 'react'
import type { TrendPoint } from '@/lib/analyticsTrends'

export function TrendChart({title,description,points,labels,percent=false,grain='day'}:{title:string;description:string;points:TrendPoint[];labels:string[];percent?:boolean;grain?:string}) {
  const id=useId()
  const [selection,setSelected]=useState<number|null>(null)
  const selected=selection===null?null:Math.min(Math.max(0,selection),Math.max(0,points.length-1))
  const [visible,setVisible]=useState(labels.map(()=>true))
  const width=900,height=270,left=62,right=22,top=20,bottom=42
  const max=Math.max(1,...points.flatMap(point=>point.values.filter((value,index)=>visible[index]&&value!==null) as number[]))
  const ceiling=percent ? Math.max(100,Math.ceil(max/25)*25) : Math.max(4,Math.ceil(max/(10**Math.floor(Math.log10(max))))*(10**Math.floor(Math.log10(max))))
  const x=(index:number)=>left+(points.length<=1 ? (width-left-right)/2 : index/(points.length-1)*(width-left-right))
  const y=(value:number)=>height-bottom-value/ceiling*(height-top-bottom)
  const format=(value:number|null)=>value===null ? 'No recipients' : percent ? `${value.toFixed(1)}%` : value.toLocaleString('en-US')
  const date=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})
  const active=selected===null ? null : points[selected]
  const hasData=points.some(point=>point.values.some(value=>value!==null&&value>0))
  const ticks=[...new Set([0,Math.floor((points.length-1)/2),points.length-1])].filter(index=>index>=0)
  return <section className="nic-analytics__card nic-trend" aria-labelledby={id}>
    <div className="nic-trend__heading"><div><h2 id={id}>{title}</h2><p className="nic-analytics__muted">{description}</p></div><span className="nic-analytics__pill">{grain==='week'?'Weekly':grain==='month'?'Monthly':'Daily'}</span></div>
    <div className="nic-trend__legend">{labels.map((label,index)=><label key={label} className={`nic-trend__series nic-trend__series--${index}`}><input type="checkbox" checked={visible[index]} onChange={()=>setVisible(current=>current.map((value,i)=>i===index?!value:value))}/><span/>{label}</label>)}</div>
    {!hasData&&<p className="nic-trend__empty">No recorded activity in this date range.</p>}
    <div className="nic-trend__plot" role="group" tabIndex={0} aria-label={`${title}. Use left and right arrow keys to inspect dates.`} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();setSelected(current=>event.key==='Home'?0:event.key==='End'?points.length-1:Math.min(points.length-1,Math.max(0,(current??0)+(event.key==='ArrowLeft'?-1:1))))}}} onMouseMove={event=>{const box=event.currentTarget.getBoundingClientRect();setSelected(Math.min(points.length-1,Math.max(0,Math.round(((event.clientX-box.left)/box.width*width-left)/(width-left-right)*(points.length-1)))))}}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}; ${points.length} time periods. Exact values are available in the data table below.`}>
        {[0,1,2,3,4].map(index=><g key={index}><line x1={left} x2={width-right} y1={y(ceiling*index/4)} y2={y(ceiling*index/4)} className="nic-trend__grid"/><text x={left-10} y={y(ceiling*index/4)+4} textAnchor="end">{percent?`${Math.round(ceiling*index/4)}%`:Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(ceiling*index/4)}</text></g>)}
        {ticks.map(index=><text key={index} x={x(index)} y={height-10} textAnchor={index===0?'start':index===points.length-1?'end':'middle'}>{date(points[index].date)}</text>)}
        {labels.map((label,index)=>visible[index]&&<g key={label} className={`nic-trend__line nic-trend__line--${index}`}><path d={points.map((point,i)=>point.values[index]===null?'':`${i===0||points[i-1].values[index]===null?'M':'L'}${x(i)},${y(point.values[index]!)}`).join(' ')} fill="none" strokeWidth={3} strokeDasharray={index===1?'7 4':undefined}/>{points.map((point,i)=>point.values[index]!==null&&<circle key={i} cx={x(i)} cy={y(point.values[index]!)} r={points.length<65?3:1.5}/>)}</g>)}
        {selected!==null&&<line x1={x(selected)} x2={x(selected)} y1={top} y2={height-bottom} className="nic-trend__cursor"/>}
      </svg>
    </div>
    <p className="nic-trend__readout" aria-live="polite">{active?<><strong>{date(active.date)}</strong>{labels.map((label,i)=><span key={label}>{label}: <b>{format(active.values[i])}</b></span>)}</>:'Point to the chart or use the arrow keys to inspect a period.'}</p>
    <details><summary>View chart data</summary><div className="nic-workspace__table-scroll"><table className="nic-analytics__table"><caption>{title} — values by period start</caption><thead><tr><th>Period starting</th>{labels.map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{points.map(point=><tr key={point.date}><td>{date(point.date)}</td>{point.values.map((value,i)=><td key={i}>{format(value)}</td>)}</tr>)}</tbody></table></div></details>
  </section>
}
