import test from 'node:test';
import assert from 'node:assert/strict';
import {adminRequestOptions} from '../src/lib/admin-request-identity.ts';

test('identity attaches to same-origin API requests only and preserves request options',()=>{
 const options={method:'POST',body:'payload',headers:{'Content-Type':'application/json'},credentials:'same-origin'};
 const result=adminRequestOptions('/api/ask',options,'https://maktab.my.id/','test');
 assert.equal(result.headers.get('Authorization'),'Bearer test');assert.equal(result.body,'payload');assert.equal(result.method,'POST');assert.equal(result.credentials,'same-origin');
 for(const input of ['https://other.example/api/ask','https://maktab.my.id.evil.example/api/x','http://maktab.my.id/api/x','/assets/file.js'])assert.equal(adminRequestOptions(input,options,'https://maktab.my.id/','test'),options);
 assert.equal(adminRequestOptions('/api/ask',options,'https://maktab.my.id/',null),options);
});

test('explicit authorization and headers on Request objects are retained',()=>{
 const request=new Request('https://maktab.my.id/api/ask',{headers:{Authorization:'Bearer explicit','X-Test':'keep'}});
 const result=adminRequestOptions(request,undefined,'https://maktab.my.id/','stored');
 assert.equal(result.headers.get('Authorization'),'Bearer explicit');assert.equal(result.headers.get('X-Test'),'keep');
});
