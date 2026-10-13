import type { VehiclePhysicsEntity } from '../src/game/physicsEngine';

export const scenarios = ['acceleration', 'brakingReverse', 'coasting', 'drift', 'turbo'] as const;
export function setScenario(car: VehiclePhysicsEntity, scenario: string, frame: number) {
  car.inputs.throttle = scenario === 'brakingReverse' && frame > 150 ? -1 : scenario === 'coasting' && frame > 150 ? 0 : 1;
  car.inputs.steer = scenario === 'drift' && frame > 90 ? -0.65 : 0;
  car.inputs.drift = scenario === 'drift' && frame > 90;
  car.inputs.boost = scenario === 'turbo';
}
export function sampleDriving(car: VehiclePhysicsEntity) {
  return [car.forwardSpeed, car.lateralSpeed, car.state.heading, car.state.boost, car.state.speedKmh, car.state.driftAngle, car.body.position.x, car.body.position.z, car.visuals.frontLeftWheel.rotation.y];
}
