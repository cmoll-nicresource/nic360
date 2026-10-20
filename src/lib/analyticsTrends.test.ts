import {describe,it,expect,vi} from 'vitest'
import type {Payload,PayloadRequest} from 'payload'
import {analyticsRange,bucketDate,fillTrend,publicationTrends,getTrafficTrends,getRegistrationTrends} from './analyticsTrends'
import type {PublicationIssueStatsRow} from './publicationAnalytics'

describe('analytics time ranges and cohorts',()=>{
  it('defaults to the inclusive last 30 Eastern dates near UTC midnight',()=>{
    expect(analyticsRange(undefined,undefined,undefined,new Date('2026-11-01T01:00:00Z'))).toEqual({from:'2026-10-02',to:'2026-10-31',grain:'day'})
  })
  it.each([['2026-02-30','2026-03-01'],['2026-03-02','2026-03-01'],['2024-01-01','2026-01-01'],['bad','bad']])('rejects invalid or excessive ranges %s to %s',(from,to)=>expect(()=>analyticsRange(from,to)).toThrow())
  it('groups Monday weeks and fills zero periods, including partial weeks across a year',()=>{
    expect(bucketDate('2027-01-01','week')).toBe('2026-12-28')
    expect(fillTrend({from:'2026-12-31',to:'2027-01-05',grain:'week'},[{date:'2026-12-28',values:[7,2]}])).toEqual([{date:'2026-12-28',values:[7,2]},{date:'2027-01-04',values:[0,0]}])
    expect(fillTrend({from:'2026-10-01',to:'2026-10-03',grain:'day'},[])).toHaveLength(3)
  })
  it('computes weighted issue-cohort rates, leaves empty denominators null and preserves UTC issue picker dates',()=>{
    const row=(values:Partial<PublicationIssueStatsRow>)=>({issueDate:'2026-10-01T00:00:00Z',recipientCount:0,opens:0,clicks:0,...values}) as PublicationIssueStatsRow
    const result=publicationTrends([row({recipientCount:10,opens:9,clicks:1}),row({recipientCount:90,opens:1,clicks:0}),row({issueDate:'2026-10-03T23:59:59Z',recipientCount:5,opens:5,clicks:2})],{from:'2026-10-01',to:'2026-10-03',grain:'day'})
    expect(result.rates.map(p=>p.values)).toEqual([[10,1],[null,null],[100,40]])
    expect(result.counts[0].values).toEqual([100,10,1])
  })
  it('blocks non-gatekeepers before any raw database query',async()=>{
    const query=vi.fn();const payload={db:{pool:{query}}} as unknown as Payload
    const range=analyticsRange('2026-10-01','2026-10-03')
    for(const user of [null,{collection:'staff',role:'editor'}] as PayloadRequest['user'][]){await expect(getTrafficTrends(payload,user,range)).rejects.toThrow('Gatekeeper');await expect(getRegistrationTrends(payload,user,range)).rejects.toThrow('Gatekeeper')}
    expect(query).not.toHaveBeenCalled()
  })
})
