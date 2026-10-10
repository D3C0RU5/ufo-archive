# Orbital

Projeto React com Vite para um arquivo visual de exploração espacial. A direção de arte foi inspirada na atmosfera escura e editorial de [war.gov/UFO](https://www.war.gov/UFO/), sem vínculo com o site ou com órgãos públicos.

## Rodar localmente

```bash
npm install
npm run dev
```

Para gerar a versão de produção:

```bash
npm run build
npm run preview
```

## Estrutura

- `src/App.jsx`: página e componentes React (`Header`, `Hero`, `Records`, `About` e `Footer`).
- `src/EarthGlobe.jsx`: globo 3D em WebGL, com rotação por arrasto, toque e teclado.
- `src/solar.js`: posição aproximada do Sol calculada a partir da hora UTC.
- `src/styles.css`: tokens de cor e tipografia, componentes visuais e ajustes responsivos.
- `public/earth-day.webp`, `public/earth-night.webp` e `public/earth-clouds.webp`: mapas globais para superfície, luzes noturnas e nuvens.
- `public/planet.webp`: imagem fotorrealista gerada para fallback quando WebGL estiver indisponível.

Os registros exibidos são exemplos conceituais. O filtro por tipo e a navegação da página funcionam localmente.

## Globo em tempo real

O globo recalcula a posição do Sol a cada 15 segundos usando o relógio UTC do dispositivo. Arraste com mouse ou toque para girar; use as setas quando o globo estiver em foco. O botão **Reorientar** ou a tecla **Home** volta à vista sugerida para o momento atual. O seletor **Satélite / Atlas / Holograma** alterna entre a textura original, uma versão cartográfica e um diagrama animado com grade de latitude e longitude, contornos e pontos de referência. Os dois estilos adicionais são derivados do mapa diurno existente.

A iluminação é calculada em tempo real. As texturas da superfície são mosaicos históricos, não imagens de satélite ao vivo:

- Mapa diurno: [NASA/Goddard Space Flight Center Scientific Visualization Studio, Blue Marble](https://svs.gsfc.nasa.gov/2915/).
- Luzes noturnas: [NASA Earth Observatory, Earth at Night 2012](https://svs.gsfc.nasa.gov/30028/).
- Nuvens: [NASA Visible Earth, Blue Marble: Clouds](https://www.visibleearth.nasa.gov/images/57747/blue-marble-clouds).
- Posição solar: [NOAA, General Solar Position Calculations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF).

Para verificar o cálculo solar, execute `npm test`.
# ufo-archive
