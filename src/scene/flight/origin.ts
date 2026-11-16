// Gốc tọa độ trôi (floating origin) cho «Bay vào vũ trụ».
//
// Mọi vị trí tuyệt đối giữ ở số thực 64 bit (km, hệ xích đạo J2000, Mặt Trời ở gốc). Máy ảnh luôn đứng ở (0, 0, 0)
// trong cảnh three.js; mỗi khung hình, vị trí của một vật = vị trí tuyệt đối − vị trí máy ảnh, trừ ở 64 bit rồi mới
// đưa vào GPU (32 bit). Vì vậy vật ở gần máy ảnh luôn có độ chính xác cao, dù cách Mặt Trời hàng trăm parsec.

export type Vec3d = Float64Array;

export const vec3d = (x = 0, y = 0, z = 0): Vec3d => Float64Array.of(x, y, z);

/** out = a − b (64 bit). */
export function sub3(a: ArrayLike<number>, b: ArrayLike<number>, out: Float64Array): Float64Array {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

export const len3 = (v: ArrayLike<number>): number => Math.hypot(v[0], v[1], v[2]);

/** Đặt vị trí cục bộ (so với máy ảnh) cho một Object3D, không cấp phát. */
export function placeRelative(obj: { position: { set(x: number, y: number, z: number): unknown } }, abs: ArrayLike<number>, cam: ArrayLike<number>): void {
  obj.position.set(abs[0] - cam[0], abs[1] - cam[1], abs[2] - cam[2]);
}

/** Làm tròn về số thực 32 bit như GPU nhận (để kiểm thử độ chính xác). */
export const f32 = (x: number): number => Math.fround(x);
