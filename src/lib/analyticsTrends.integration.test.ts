import pg from 'pg'
import type {Payload,PayloadRequest} from 'payload'
import {describe,it,expect,beforeAll,afterAll} from 'vitest'
import {getTrafficTrends,getRegistrationTrends,analyticsRange} from './analyticsTrends'

describe.skipIf(process.env.ANALYTICS_INTEGRATION!=='1')('analytics aggregate SQL',()=>{
  let client:pg.Client,payload:Payload
  const user={collection:'staff',role:'gatekeeper'} as PayloadRequest['user']
  beforeAll(async()=>{
    const uri=process.env.TEST_DATABASE_URI??(process.env.CI?process.env.DATABASE_URI:undefined)??'postgresql://postgres:local-e2e-only@127.0.0.1:5444/nic360_e2e_test'
    const url=new URL(uri)
    if(!['127.0.0.1','localhost'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw Error('Isolated test database required')
    client=new pg.Client({connectionString:uri});await client.connect();await client.query('BEGIN')
    // Temporary tables and query rewriting keep fixtures independent of the real schema.
    await client.query(`CREATE TEMP TABLE analytics_users(id int primary key,email text,first_name text,last_name text);
      CREATE TEMP TABLE analytics_page_views(id serial,visitor_id int,path text,created_at timestamptz);
      CREATE TEMP TABLE analytics_event_registrations(event_id int,status text,attendance text,created_at timestamptz);
      INSERT INTO analytics_users VALUES(1,'one@example.invalid','One','User'),(2,'two@example.invalid','Two','User');
      INSERT INTO analytics_page_views(visitor_id,path,created_at) VALUES
      (1,'/research/1','2026-03-08T04:59:59.999Z'),(1,'/research/1','2026-03-08T05:00:00Z'),
      (1,'/research/2','2026-03-09T03:59:59.999Z'),(2,'/bills/1','2026-03-08T12:00:00Z'),
      (NULL,'/','2026-03-08T12:00:00Z'),(1,'/research/1','2026-03-09T04:00:00Z'),
      (1,'/research/fall','2026-11-01T04:00:00Z'),(1,'/research/fall','2026-11-02T04:59:59.999Z'),(2,'/research/fall','2026-11-02T05:00:00Z');
      INSERT INTO analytics_event_registrations VALUES(1,'active','virtual','2026-03-08T12:00:00Z'),(1,'cancelled','in-person','2026-03-08T12:00:00Z'),(2,'active','in-person','2026-03-08T12:00:00Z'),(1,'pending','virtual','2026-03-08T12:00:00Z');`)
    payload={db:{pool:{query:(sql:string,args:unknown[])=>client.query(sql.replaceAll('public.page_views','analytics_page_views').replaceAll('public.users','analytics_users').replaceAll('public.event_registrations','analytics_event_registrations'),args)}}} as unknown as Payload
  })
  afterAll(async()=>{if(client){await client.query('ROLLBACK');await client.end()}})
  it('handles 23-hour and 25-hour days, exclusive end midnight and distinct users',async()=>{
    const spring=await getTrafficTrends(payload,user,analyticsRange('2026-03-08','2026-03-08'))
    expect([spring.views,spring.visitors]).toEqual([4,2]);expect(spring.points[0].values).toEqual([4,2])
    const fall=await getTrafficTrends(payload,user,analyticsRange('2026-11-01','2026-11-01'))
    expect([fall.views,fall.visitors]).toEqual([2,1])
  })
  it('scopes pages, sections, users and SQL-injection-looking paths using parameters',async()=>{
    const range=analyticsRange('2026-03-08','2026-03-08')
    expect((await getTrafficTrends(payload,user,range,{section:'research'})).views).toBe(2)
    expect((await getTrafficTrends(payload,user,range,{userId:2})).views).toBe(1)
    expect((await getTrafficTrends(payload,user,range,{path:'/research/1'})).views).toBe(1)
    expect((await getTrafficTrends(payload,user,range,{path:"/' OR 1=1--"})).views).toBe(0)
  })
  it('does not sum daily distinct counts when grouping by week',async()=>{
    const result=await getTrafficTrends(payload,user,analyticsRange('2026-03-07','2026-03-08','week'))
    expect(result.visitors).toBe(2);expect(result.points[0].values).toEqual([5,2])
  })
  it('counts all visits above 10,000 while bounding the detail table',async()=>{
    await client.query("INSERT INTO analytics_page_views(visitor_id,path,created_at) SELECT 1,'/research/busy','2026-10-16T12:00:00Z' FROM generate_series(1,10001)")
    const result=await getTrafficTrends(payload,user,analyticsRange('2026-10-16','2026-10-16'),{path:'/research/busy'})
    expect(result.views).toBe(10001);expect(result.points[0].values).toEqual([10001,1]);expect(result.history).toHaveLength(1000)
  })
  it('excludes pending/cancelled registrations and scopes a specific event',async()=>{
    const result=await getRegistrationTrends(payload,user,analyticsRange('2026-03-08','2026-03-09'),1)
    expect(result.map(point=>point.values)).toEqual([[0,1],[0,0]])
  })
})
