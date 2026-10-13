// Local forward is +Z: positive yaw turns left from the driver's viewpoint.
// Keep the original driving equation (-steer) and invert only the input axis.
export function readPlayerAxes(keys: Record<string, boolean>, virtual: { throttle: number; steer: number }) {
  let throttle = virtual.throttle;
  if (keys.KeyW || keys.ArrowUp) throttle = 1;
  if (keys.KeyS || keys.ArrowDown) throttle = -1;
  let steer = virtual.steer;
  if (keys.KeyA || keys.ArrowLeft) steer = -1;
  if (keys.KeyD || keys.ArrowRight) steer = 1;
  return { throttle, steer };
}
