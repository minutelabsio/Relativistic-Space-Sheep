/**
 * PhysicsJS v1.0.0-rc1 - 2014-03-23
 * A modular, extendable, and easy-to-use physics engine for javascript
 * http://wellcaffeinated.net/PhysicsJS
 *
 * Copyright (c) 2014 Jasper Palfree <jasper@wellcaffeinated.net>
 * Licensed MIT
 */

(function(e,t){typeof define=="function"&&define.amd?define(["physicsjs"],t):typeof exports=="object"?module.exports=t.apply(e,["physicsjs"].map(require)):t.call(e,e.Physics)})(this,function(e){return e.geometry("convex-polygon",function(t){var n="Error: The vertices specified do not match that of a _convex_ polygon.",r={};return{init:function(n){t.init.call(this,n),n=e.util.extend({},r,n),this.setVertices(n.vertices||[])},setVertices:function(t){var r=e.scratchpad(),i=r.transform(),s=this.vertices=[];if(!e.geometry.isPolygonConvex(t))throw n;i.setRotation(0),i.setTranslation(e.geometry.getPolygonCentroid(t).negate());for(var o=0,u=t.length;o<u;++o)s.push(e.vector(t[o]).translate(i));return this._area=e.geometry.getPolygonArea(s),this._aabb=!1,r.done(),this},aabb:function(t){if(!t&&this._aabb)return this._aabb.get();var n=e.scratchpad(),r=n.vector(),i=n.transform().setRotation(t||0),s=n.vector().clone(e.vector.axis[0]).rotateInv(i),o=n.vector().clone(e.vector.axis[1]).rotateInv(i),u=this.getFarthestHullPoint(s,r).proj(s),a=-this.getFarthestHullPoint(s.negate(),r).proj(s),f=this.getFarthestHullPoint(o,r).proj(o),l=-this.getFarthestHullPoint(o.negate(),r).proj(o),c;return c=new e.aabb(a,l,u,f),t||(this._aabb=c),n.done(),c.get()},getFarthestHullPoint:function(t,n,r){var i=this.vertices,s,o,u=i.length,a=2,f;n=n||e.vector();if(u<2)return r&&(r.idx=0),n.clone(i[0]);o=i[0].dot(t),s=i[1].dot(t);if(u===2)return f=s>=o?1:0,r&&(r.idx=f),n.clone(i[f]);if(s>=o){while(a<u&&s>=o)o=s,s=i[a].dot(t),a++;return s>=o&&a++,f=a-2,r&&(r.idx=a-2),n.clone(i[f])}a=u;while(a>1&&o>=s)a--,s=o,o=i[a].dot(t);return f=(a+1)%u,r&&(r.idx=f),n.clone(i[f])},getFarthestCorePoint:function(t,n,r){var i,s=e.scratchpad(),o=s.vector(),u=s.vector(),a=this.vertices,f=a.length,l,c=this._area>0,h={};return n=this.getFarthestHullPoint(t,n,h),o.clone(a[(h.idx+1)%f]).vsub(n).normalize().perp(c),u.clone(a[(h.idx-1+f)%f]).vsub(n).normalize().perp(!c),l=r/(1+o.dot(u)),n.vadd(o.vadd(u).mult(l)),s.done(),n}}}),e});