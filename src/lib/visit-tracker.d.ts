export function visitPath(href:string):string|null;
export function recordVisit(path:string|null):void;
export function recordSiteAction(action:'qris_view'|'qris_download'):void;
export function startVisitTracking():()=>void;
