import { test, expect } from '@playwright/test';

test('menu, controls, match HUD, pause, resume, quick restart and return to showroom', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ÚLTIMO MOTOR', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Controles', exact: true }).click();
  await expect(page.getByText('Usar Arma / Power-up')).toBeVisible();
  await page.getByRole('button', { name: 'Entendido' }).click();
  await page.getByRole('button', { name: 'ENTRAR NA ARENA' }).click();
  await expect(page.getByText('SLOT DE ITEM • ATIVAR [E]')).toBeVisible();
  await expect(page.getByText('6 / 6 SOBREVIVENTES')).toBeVisible();
  await page.keyboard.down('w');
  await expect.poll(async () => Number(await page.locator('.font-mono.text-3xl').innerText())).toBeGreaterThan(0);
  await page.keyboard.up('w');
  await page.keyboard.press('c');
  await expect(page.getByText('LONGE [C]')).toBeVisible();
  await page.keyboard.press('p');
  await expect(page.getByRole('heading', { name: 'JOGO PAUSADO' })).toBeVisible();
  await page.getByRole('button', { name: 'CONTINUAR PARTIDA' }).click();
  await expect(page.getByRole('heading', { name: 'JOGO PAUSADO' })).toBeHidden();
  await page.keyboard.press('r');
  await expect(page.getByText('6 / 6 SOBREVIVENTES')).toBeVisible();
  await expect(page.getByText('LONGE [C]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'VOLTAR AO MENU PRINCIPAL' }).click();
  await expect(page.getByRole('button', { name: 'ENTRAR NA ARENA' })).toBeVisible();
  await page.screenshot({ path: 'test-results/menu.png' });
  expect(errors).toEqual([]);
});

test('mobile HUD keeps item, survivors and virtual controls visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTRAR NA ARENA' }).click();
  await expect(page.getByText('6/6 SOBREVIVENTES')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Colete um item' })).toBeVisible();
  const left = page.getByTitle('Virar à Esquerda (A / ←)');
  await expect(left).toBeVisible();
  const box = await left.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/mobile-hud.png' });
});

test('real WebGL engine: pickups, E activation, shield, phase progression, victory and clean restart', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tests/browser/harness.html');
  await page.waitForFunction(() => Boolean((window as any).engine));
  const result = await page.evaluate(() => {
    const engine = (window as any).engine;
    engine.startMatch('BRAWLER');
    cancelAnimationFrame(engine.animationFrameId);
    const p = engine.playerEntity;
    const pickup = engine.combat.pickups.find((point: { position: { x: number; z: number } }) => Math.hypot(point.position.x, point.position.z) < 30);
    p.body.position.set(pickup.position.x, p.body.position.y, pickup.position.z);
    engine.update(1 / 60, 1 / 60);
    const acquired = Boolean(p.state.item);
    p.state.item = { type: 'SHIELD', ammo: 1 };
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    engine.update(1 / 60, 1 / 60);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
    const shield = p.state.shieldTime > 0;
    const hpBefore = p.state.hp;
    engine.damage.apply(p, 20, 'weapons', engine.matchTime, engine.allEntities[1], 'ENERGIA');
    const mitigated = Math.abs(hpBefore - p.state.hp - 7) < 0.001;
    engine.matchTime = 40; engine.update(1 / 60, 1 / 60);
    const zone = engine.currentZoneRadius;
    engine.allEntities.filter((e: { isPlayer: boolean }) => !e.isPlayer).forEach((e: unknown) => engine.damage.apply(e, 999, 'weapons', engine.matchTime, p, 'ENERGIA'));
    engine.checkMatchConditions();
    const victory = (window as any).results.end;
    engine.startMatch('INTERCEPTOR');
    cancelAnimationFrame(engine.animationFrameId);
    const fresh = { count: engine.physics.vehicles.size, shots: engine.combat.shots.length, shield: engine.playerEntity.state.shieldTime, hp: engine.playerEntity.state.hp, time: engine.matchTime };
    engine.returnToMenu('INTERCEPTOR', '#06b6d4');
    cancelAnimationFrame(engine.animationFrameId);
    const showroom = engine.isShowroom && Boolean(engine.showroomCar) && engine.physics.vehicles.size === 0;
    engine.destroy();
    return { acquired, shield, mitigated, zone, victory, fresh, showroom };
  });
  expect(result.acquired).toBe(true); expect(result.shield).toBe(true); expect(result.mitigated).toBe(true);
  expect(result.zone).toBeLessThan(85); expect(result.zone).toBeGreaterThan(70);
  expect(result.victory.isVictory).toBe(true); expect(result.victory.placement).toBe(1);
  expect(result.fresh).toMatchObject({ count: 6, shots: 0, shield: 0, hp: 85 });
  expect(result.fresh.time).toBeLessThan(0.1);
  expect(result.showroom).toBe(true);
  expect(errors).toEqual([]);
});

test('real engine resolves defeat, zone damage and freezes simulation while paused', async ({ page }) => {
  await page.goto('/tests/browser/harness.html');
  await page.waitForFunction(() => Boolean((window as any).engine));
  await page.evaluate(() => (window as any).engine.startMatch('BRUISER'));
  await page.evaluate(() => (window as any).engine.setPaused(true));
  const time = await page.evaluate(() => (window as any).engine.matchTime);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as any).engine.matchTime)).toBe(time);
  const result = await page.evaluate(() => {
    const engine = (window as any).engine;
    cancelAnimationFrame(engine.animationFrameId);
    engine.setPaused(false);
    engine.matchTime = 150;
    engine.playerEntity.body.position.set(70, 1, 0);
    const before = engine.playerEntity.state.hp;
    engine.updateShrinkingZone(1);
    const outsideDamage = before - engine.playerEntity.state.hp;
    engine.damage.apply(engine.playerEntity, 999, 'weapons', engine.matchTime, engine.allEntities[1], 'FOGUETE');
    engine.checkMatchConditions();
    const end = (window as any).results.end;
    engine.destroy();
    return { outsideDamage, end };
  });
  expect(result.outsideDamage).toBeCloseTo(6.6);
  expect(result.end.isVictory).toBe(false); expect(result.end.placement).toBe(6);
});

for (const matchSeed of [317, 842, 1127]) {
test(`bots drive the real arena, collect items and deal more weapon than collision damage (seed ${matchSeed})`, async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/tests/browser/harness.html');
  await page.waitForFunction(() => Boolean((window as any).engine));
  const result = await page.evaluate((matchSeed) => {
    const engine = (window as any).engine;
    let seed = matchSeed;
    const originalRandom = Math.random;
    Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const liveLoop = engine.loop;
    engine.loop = () => {};
    engine.startMatch('BRAWLER');
    engine.loop = liveLoop;
    cancelAnimationFrame(engine.animationFrameId);
    // Automate the player's driving as well, using the same AI, to exercise combat.
    engine.ai.registerBot(engine.playerEntity, 'opportunist');
    const normalCheck = engine.checkMatchConditions;
    engine.checkMatchConditions = () => {};
    for (let frame = 0; frame < 60 * 100; frame++) {
      engine.update(1 / 60, 1 / 60);
      if (engine.allEntities.filter((e: { state: { isDead: boolean } }) => !e.state.isDead).length <= 1) break;
    }
    const result = {
      totals: { ...engine.damage.totals },
      acquisitions: engine.allEntities.reduce((sum: number, e: { state: { itemAcquired: number } }) => sum + e.state.itemAcquired, 0),
      deaths: engine.allEntities.filter((e: { state: { isDead: boolean } }) => e.state.isDead).length,
      finite: engine.allEntities.every((e: { body: { position: { x: number; z: number } } }) => Number.isFinite(e.body.position.x) && Number.isFinite(e.body.position.z)),
    };
    engine.checkMatchConditions = normalCheck;
    Math.random = originalRandom;
    engine.destroy();
    return result;
  }, matchSeed);
  console.log('AUTONOMOUS_MATCH', JSON.stringify(result));
  expect(result.acquisitions).toBeGreaterThan(6);
  expect(result.totals.weapons).toBeGreaterThan(result.totals.collisions);
  expect(result.deaths).toBeGreaterThan(0);
  expect(result.finite).toBe(true);
});
}
