import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
// Independent reader: consumes the final gzip/NBT, never the writer's intermediate objects.
export function readSchematic(bytes) {
  const b=gunzipSync(bytes); let p=0;
  const u8=()=>b.readUInt8(p++), u16=()=>{const n=b.readUInt16BE(p);p+=2;return n;}, i32=()=>{const n=b.readInt32BE(p);p+=4;return n;};
  const str=()=>{const n=u16(),s=b.toString('utf8',p,p+n);p+=n;return s;};
  function payload(t) {
    if(t===2) return u16();
    if(t===3) return i32();
    if(t===7) {const n=i32(),v=b.subarray(p,p+n);p+=n;return v;}
    if(t===9) {const subtype=u8(),n=i32();return Array.from({length:n},()=>payload(subtype));}
    if(t===10) {const o=Object.create(null);for(let t;(t=u8())!==0;) {const name=str();o[name]=payload(t);}return o;}
    if(t===11) return Array.from({length:i32()},i32);
    throw Error(`Unsupported NBT tag ${t}`);
  }
  assert.equal(u8(),10);assert.equal(str(),'');const root=payload(10);assert.equal(p,b.length,'no trailing NBT');
  const s=root.Schematic, states=[]; for (const [state,id] of Object.entries(s.Blocks.Palette)) states[id]=state;
  const indices=[];let value=0,shift=0;
  for (const byte of s.Blocks.Data) {value|=(byte&127)<<shift;if(byte&128) shift+=7;else {indices.push(value);value=shift=0;}}
  assert.equal(shift,0);assert.equal(indices.length,s.Width*s.Height*s.Length);
  for(const n of indices) assert.equal(typeof states[n],'string');
  s.at=(x,y,z)=>states[indices[x-s.Offset[0]+(z-s.Offset[2])*s.Width+(y-s.Offset[1])*s.Width*s.Length]];
  return s;
}
