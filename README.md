# Último Motor — Motor Royale

Battle Royale arcade para navegador: um jogador e cinco bots na Arena Zero. O último veículo vivo vence. O projeto mantém os veículos e a câmera existentes; armas, itens e zona usam módulos próprios.

## Jogar

```powershell
npm.cmd install
npm.cmd run dev
```

Abra `http://localhost:3000`. No PowerShell, use `npm.cmd` caso a política de execução bloqueie `npm.ps1`.

| Controle | Ação |
| --- | --- |
| W / ↑ | Acelerar |
| S / ↓ | Frear e dar ré |
| A / ← | Virar à esquerda |
| D / → | Virar à direita |
| Espaço | Drift |
| Shift | Turbo |
| E | Usar item / disparar |
| C | Alternar câmera |
| P / Esc | Pausar / continuar |
| R | Reiniciar |

Há também botões na tela. Atravesse os pickups dourados para preencher o único slot. Um item ocupado impede novas coletas. O uso do item mantém o carro em movimento.

- **Foguete:** 38 de dano, trava em alvos à frente até 48m, curva com velocidade limitada e perde o rastreio atrás de obstáculos. Um alerta avisa o alvo. Munição limitada.
- **Mina:** depositada atrás, arma em 0,7s, dura até 24s, causa até 52 de dano em área; obstáculos protegem do blast.
- **Energia:** 22 de dano, tiro frontal rápido, sem rastreio. A colisão verifica todo o trajeto entre quadros. Ricochete não foi incluído.
- **Escudo:** reduz dano de todas as fontes em 65% por 6s.
- **Reparo:** restaura até 35 de integridade, limitado à blindagem máxima.
- **Sobrecarga:** reserva de turbo até 160 por 8s, mantendo velocidade, aceleração e consumo normais do turbo.
- **Munição dupla:** ative e colete a próxima arma em até 18s. Ela terá dois disparos, separados por pelo menos 0,45s.

O anel amarelo, na arena e no radar, mostra a próxima área segura. A zona passa de 85m de raio para 70m, 55m e 42m. O fechamento tem aviso e contador; o dano externo cresce com as fases. A área final mantém 84m de diâmetro.

## Balanceamento e módulos

Edite `src/game/royaleConfig.ts`: dano, pesos de itens, recarga, duração, respawn, fases e escalas por fonte estão centralizados. Os alvos 75% armas / 15% ambiente / 10% colisões são metas de gameplay, não quotas impostas às partidas. `DamageSystem.totals` e `onStateUpdate.damageTotals` medem dano efetivamente recebido, após escudo e limite de vida.

Contatos reais entre carros substituem a antiga detecção por grandes círculos. Impactos abaixo de 50km/h de velocidade normal de aproximação não causam dano. O limite inicial efetivo de uma colisão é 3,6, antes do escudo. Contato contínuo mantém um bloqueio; uma nova batida exige pelo menos 3s sem contato. A resposta física continua em Cannon, com restituição baixa entre carros e transferência limitada para a memória de velocidade, sem empurrão aleatório ou teleporte.

`physicsEngine.ts` conserva o método de condução; `playerInput.ts` corrige o eixo horizontal. `damageSystem.ts` centraliza dano e eliminações; `combatSystem.ts` implementa armas, pickups e efeitos limitados; `zoneSystem.ts` calcula fases. Os bots procuram itens, mantêm distância de combate, atacam uns aos outros, usam defesa, desviam de obstáculos e reagem à zona e aos foguetes.

## Validação

```powershell
npm.cmd run lint
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:browser
npm.cmd run build
```

Os testes de condução comparam trajetórias dos três veículos contra `tests/approved-driving.json`, capturado da versão original identificada por `sourceCommit` no arquivo. Cobrem aceleração, frenagem/ré, inércia, drift e turbo; testam separadamente o sentido das curvas, inclusive em ré. Isso verifica regressões numéricas, sem substituir a avaliação humana do feeling.

Os testes de lógica cobrem impactos, armas, cobertura, evasão, power-ups, pickups rápidos, bots, zona e atribuição de eliminações. Playwright executa o app e o motor WebGL: menus, HUD móvel, pausa, reinício, coleta, E, escudo, vitória, derrota e partidas automatizadas com três sementes. O harness fica em `tests/browser/harness.html` e não integra o bundle de produção.

O balanceamento continua sujeito a partidas humanas. As porcentagens variam com mapa, itens, classe e decisões dos jogadores. O build pode avisar sobre o tamanho do bundle Three.js/Cannon e o código de sombra herdado; esses avisos não impedem compilação.
