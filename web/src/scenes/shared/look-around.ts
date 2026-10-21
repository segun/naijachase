import type { CameraShot } from "./scene-core.ts";
/** Turn at a fixed viewpoint, keeping the camera out of walls and walking paths. */
export function lookAround(base: CameraShot, yaw: number, pitch: number): CameraShot {
  const dx=base.target[0]-base.position[0],dz=base.target[2]-base.position[2];
  const distance=Math.hypot(dx,dz),angle=Math.atan2(dx,dz)+Math.max(-1.35,Math.min(1.35,yaw));
  return {position:base.position,target:[base.position[0]+Math.sin(angle)*distance,base.target[1]+Math.max(-.4,Math.min(.4,pitch))*distance,base.position[2]+Math.cos(angle)*distance]};
}
