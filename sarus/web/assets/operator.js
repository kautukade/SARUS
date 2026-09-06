'use strict';

let pendingOperatorRequest=null;
let pendingOperatorTarget='operator-file-output';

async function typedOperator(action_id,parameters,target){
  try{
    const r=await API.post('/api/system/action',{action_id,parameters});
    jsonBox(target,r);
    if(r.status==='approval_required'){
      pendingOperatorRequest={request_id:r.request_id,action_id,parameters};pendingOperatorTarget=target;
      document.getElementById('operator-approval-panel').hidden=false;
      jsonBox('operator-approval-request',pendingOperatorRequest);
      document.getElementById('operator-approval-proof').value='';
      toast('Save and review the request, then paste its trusted approval proof.','warn');
    }else if(!r.ok)toast(r.error||r.result?.error||r.status,'bad');
  }catch(e){jsonBox(target,e.payload||('Error: '+e.message));toast(e.message,'bad');}
}
function saveOperatorRequest(){
  if(!pendingOperatorRequest)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(pendingOperatorRequest,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='jubi-approval-request.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function approveOperator(){
  const proof=document.getElementById('operator-approval-proof').value.trim(),btn=document.getElementById('operator-approve');
  if(!pendingOperatorRequest||!proof)return toast('Paste the proof for the displayed request','bad');
  setBusy(btn,true,'Executing');
  try{
    const result=await API.post('/api/system/action',pendingOperatorRequest,{'X-JUBI-Approval':proof});
    jsonBox(pendingOperatorTarget,result);
    if(result.status==='approval_required')return toast('Proof is invalid or expired. Generate a new proof for this request.','bad');
    if(!result.ok)return toast(result.error||result.result?.error||'Action failed','bad');
    pendingOperatorRequest=null;document.getElementById('operator-approval-panel').hidden=true;toast('Approved action completed','ok');
  }catch(e){jsonBox(pendingOperatorTarget,e.payload||e.message);toast(e.message,'bad');}
  finally{document.getElementById('operator-approval-proof').value='';setBusy(btn,false);}
}
function opPath(id){return String(document.getElementById(id)?.value||'').trim();}
document.addEventListener('DOMContentLoaded',()=>{
  const bind=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=fn;};
  bind('operator-save-request',saveOperatorRequest);bind('operator-approve',approveOperator);
  bind('path-stat',()=>typedOperator('workspace.path.stat',{path:opPath('file-path')},'file-output'));
  bind('dir-list',()=>typedOperator('workspace.directory.list',{path:opPath('file-path')},'file-output'));
  bind('dir-create',()=>typedOperator('workspace.directory.create',{path:opPath('file-path'),parents:true},'file-output'));
  bind('operator-copy',()=>typedOperator('workspace.file.copy',{source_path:opPath('operator-source'),destination_path:opPath('operator-destination'),overwrite:false},'operator-file-output'));
  bind('operator-move',()=>typedOperator('workspace.file.move',{source_path:opPath('operator-source'),destination_path:opPath('operator-destination'),overwrite:false},'operator-file-output'));
  bind('operator-delete',()=>typedOperator('workspace.file.delete',{path:opPath('operator-source')},'operator-file-output'));
  bind('git-status',()=>typedOperator('development.git.status',{path:opPath('operator-project')},'operator-dev-output'));
  bind('git-log',()=>typedOperator('development.git.log',{path:opPath('operator-project'),limit:20},'operator-dev-output'));
  bind('app-launch',()=>typedOperator('app.launch',{resource_id:document.getElementById('operator-app').value,workspace_path:opPath('operator-project')},'operator-dev-output'));
});
