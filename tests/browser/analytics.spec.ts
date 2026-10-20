import {test,expect} from '@playwright/test'
import pg from 'pg'
import {fixtures as f,signIn,roleContext} from '../support/fixtures'

let client:pg.Client
const path='/research/analytics-chart-'+crypto.randomUUID()
const viewIds:number[]=[]
let issueId:number
test.beforeAll(async()=>{
  const uri=process.env.TEST_DATABASE_URI??'postgresql://postgres:local-e2e-only@127.0.0.1:5444/nic360_e2e_test'
  const url=new URL(uri)
  if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw Error('Isolated analytics fixtures only')
  client=new pg.Client({connectionString:uri});await client.connect()
  for(const visitor of [f.users.premium.id,f.users.premium.id,f.users.base.id,null]){
    const result=await client.query('INSERT INTO public.page_views(path,visitor_id,created_at) VALUES($1,$2,$3) RETURNING id',[path,visitor,'2026-03-08T12:00:00Z']);viewIds.push(result.rows[0].id)
  }
  issueId=(await client.query(`INSERT INTO public.publication_issues(publication_id,title,issue_date,format,_status,email_status,stats_recipient_count,stats_opens,stats_clicks) VALUES($1,$2,'2026-03-10T23:59:59Z','excerpt-list','published','sent',100,40,7) RETURNING id`,[f.publications['us-news-clippings'],'Analytics chart fixture '+path])).rows[0].id
})
test.afterAll(async()=>{if(client){await client.query('DELETE FROM public.page_views WHERE id=ANY($1::int[])',[viewIds]);if(issueId)await client.query('DELETE FROM public.publication_issues WHERE id=$1',[issueId]);await client.end()}})

test('traffic charts filter dates and pages, expose exact data and support keyboard inspection',async({page,context},info)=>{
  await signIn(context.request,'gatekeeper')
  await page.goto('/admin/analytics?tab=pages&dateFrom=2026-03-08&dateTo=2026-03-10&grain=day&path='+encodeURIComponent(path))
  const chart=page.getByRole('region',{name:'Selected page activity over time',exact:true})
  await expect(chart.getByRole('img')).toBeVisible()
  await chart.getByRole('group',{name:/Use left and right arrow keys/}).focus();await page.keyboard.press('Home')
  await expect(chart.locator('[aria-live]')).toContainText('Page views: 4')
  await expect(chart.locator('[aria-live]')).toContainText('Signed-in users: 2')
  await page.keyboard.press('End');await expect(chart.locator('[aria-live]')).toContainText('Page views: 0')
  await chart.getByText('View chart data',{exact:true}).click()
  await expect(chart.getByRole('row')).toHaveCount(4)
  await chart.getByRole('checkbox',{name:'Signed-in users',exact:true}).uncheck()
  await expect(chart.locator('.nic-trend__line--1')).toHaveCount(0)
  await expect(page.getByText('Showing 4 of 4 visits',{exact:false})).toBeVisible()
  const group=page.getByRole('combobox',{name:'Group by'});await group.selectOption('week');await page.getByRole('button',{name:'Update charts'}).click()
  await expect(page.getByRole('combobox',{name:'Page',exact:true})).toHaveValue(path)
  await expect(page.getByRole('region',{name:'Selected page activity over time'}).getByText('Weekly',{exact:true})).toBeVisible()
  if(info.project.name==='chromium')await page.screenshot({path:'.test-artifacts/analytics-desktop.png',fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})

test('publication cohorts include the full last issue date and event charts render',async({page,context},info)=>{
  await signIn(context.request,'admin')
  await page.goto('/admin/analytics?tab=publications&dateFrom=2026-03-08&dateTo=2026-03-10&keyword='+encodeURIComponent('Analytics chart fixture '+path))
  const chart=page.getByRole('region',{name:'Publication engagement rates',exact:true})
  await chart.getByRole('group',{name:/Use left and right arrow keys/}).focus();await page.keyboard.press('End')
  await expect(chart.locator('[aria-live]')).toContainText('Open rate: 40.0%')
  await expect(chart.locator('[aria-live]')).toContainText('Click rate: 7.0%')
  await page.keyboard.press('Home');await expect(chart.locator('[aria-live]')).toContainText('No recipients')
  await page.goto('/admin/analytics?tab=events&dateFrom=2026-03-08&dateTo=2026-03-10')
  await expect(page.getByRole('region',{name:'Event registrations over time'}).getByRole('img')).toBeVisible()
  await page.goto('/admin/analytics?dateFrom=2026-03-08&dateTo=2026-03-10')
  await expect(page.getByRole('heading',{name:'Views by section',exact:true})).toBeVisible()
  if(info.project.name==='chromium')await page.screenshot({path:'.test-artifacts/analytics-overview.png',fullPage:true})
})

test('editors cannot see analytics and malformed ranges fail without a server error',async({page,context,browser})=>{
  const editor=await roleContext(browser,'editor')
  try { const forbidden=await editor.newPage();const denied=await forbidden.goto('/admin/analytics');expect(denied?.status()).toBe(404);await expect(forbidden.getByRole('heading',{name:'Nothing found',exact:true})).toBeVisible();await expect(forbidden.getByRole('img',{name:/Site activity over time/})).toHaveCount(0) }finally{await editor.close()}
  await signIn(context.request,'gatekeeper')
  const response=await page.goto('/admin/analytics?dateFrom=2026-02-30&dateTo=2026-03-01')
  expect(response?.status()).toBe(200);await expect(page.getByRole('alert')).toContainText('Choose valid dates')
})
