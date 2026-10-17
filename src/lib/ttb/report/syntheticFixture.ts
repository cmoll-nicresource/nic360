import type {ClientBase} from 'pg'
import fixture from '../../../../tests/fixtures/trade-reference.json'
/** Public dimensions and invented facts, restricted to a disposable test database. */
export async function loadSyntheticTradeFixture(client:ClientBase){
 const {rows:[db]}=await client.query('SELECT current_database() AS name')
 if(!String(db.name).endsWith('_test'))throw new Error('Synthetic trade fixture requires a disposable _test database')
 const {rows:[existing]}=await client.query("SELECT to_regclass('trade.export_fact') AS table")
 if(existing.table)throw new Error('Synthetic trade fixture requires empty trade schemas')
 await client.query(`CREATE SCHEMA IF NOT EXISTS ref;CREATE SCHEMA IF NOT EXISTS trade;CREATE SCHEMA IF NOT EXISTS report;
 CREATE TABLE ref.country(cty_code integer PRIMARY KEY,name text);
 CREATE TABLE ref.hts(hts text PRIMARY KEY,unit_qy1 text);
 CREATE TABLE report.line(line_id integer PRIMARY KEY,chapter_id text,sort_order integer,description text,part1_desc text,short_name text,indent integer,chart_group text,qty_divisor numeric,value_divisor numeric,qty_multiplier numeric,is_total boolean);
 CREATE TABLE report.line_member(line_id integer,hts text,valid_from date,valid_to date);
 CREATE TABLE trade.export_fact(hts text,yr integer,mo integer,cty_code integer,dom_or_for integer,all_qy1_mo numeric,all_qy1_yr numeric,all_val_mo numeric,all_val_yr numeric);
 CREATE TABLE trade.import_fact(hts text,yr integer,mo integer,cty_code integer,rate_prov integer,con_qy1_mo numeric,con_qy1_yr numeric,con_val_mo numeric,con_val_yr numeric,con_cha_mo numeric,con_cha_yr numeric,gen_qy1_mo numeric,gen_qy1_yr numeric,gen_val_mo numeric,gen_val_yr numeric,gen_cha_mo numeric,gen_cha_yr numeric);
 INSERT INTO ref.country VALUES(1,'Synthetic A'),(2,'Synthetic B');`)
 await client.query(`INSERT INTO report.line SELECT * FROM jsonb_populate_recordset(NULL::report.line,$1::jsonb)`,[JSON.stringify(fixture.lines)])
 await client.query(`INSERT INTO report.line_member SELECT * FROM jsonb_populate_recordset(NULL::report.line_member,$1::jsonb)`,[JSON.stringify(fixture.members)])
 await client.query(`INSERT INTO ref.hts SELECT * FROM jsonb_populate_recordset(NULL::ref.hts,$1::jsonb)`,[JSON.stringify(fixture.hts)])
 await client.query(`INSERT INTO trade.export_fact SELECT h.hts,y,m,c,1,12.5*c,12.5*c*m,100.25*c,100.25*c*m FROM ref.hts h CROSS JOIN generate_series(2025,2026)y CROSS JOIN generate_series(1,12)m CROSS JOIN generate_series(1,2)c;
 INSERT INTO trade.import_fact SELECT h.hts,y,m,c,18,15.5*c,15.5*c*m,125.25*c,125.25*c*m,5.25*c,5.25*c*m,20.5*c,20.5*c*m,150.25*c,150.25*c*m,6.25*c,6.25*c*m FROM ref.hts h CROSS JOIN generate_series(2025,2026)y CROSS JOIN generate_series(1,12)m CROSS JOIN generate_series(1,2)c;`)
}
