# Orbital

Mapa interativo de quatro relatos de avistamentos. O globo WebGL pode ser girado com mouse, toque ou teclado e oferece os modos Satélite, Atlas e Holograma. Ao selecionar um ponto ou um item da lista, o painel ao lado mostra data, local, resumo, imagens relacionadas e fonte. Em telas estreitas, o painel aparece abaixo do mapa.

## Rodar localmente

```bash
npm install
npm run dev
```

Para verificar a versão de produção e o cálculo solar:

```bash
npm run build
npm test
```

## Imagens dos relatos

As imagens ficam em `public/sightings/` e são servidas localmente. As legendas no painel identificam documentos de época e fotos posteriores dos locais; estas fotos não mostram os objetos relatados.

| Relato | Imagens e crédito |
| --- | --- |
| Operação Prato | Páginas 64 e 65 do [Relatório de Ocorrências de OVNI, Arquivo Nacional](https://imagem.sian.an.gov.br/acervo/derivadas/BR_DFANBSB_ARX/0/0/0719/BR_DFANBSB_ARX_0_0_0719_d0001de0001.pdf). |
| Noite Oficial dos OVNIs | [Relato de piloto, Arquivo Nacional](https://imagem.sian.an.gov.br/acervo/derivadas/BR_DFANBSB_ARX/0/0/0254/BR_DFANBSB_ARX_0_0_0254_d0001de0001.pdf) e [foto posterior do aeroporto de São José dos Campos, Fontela01, domínio público](https://commons.wikimedia.org/wiki/File:Aeroporto_de_s%C3%A3o_jos%C3%A9_dos_campos.jpg). |
| Rendlesham | [Memorando de Charles Halt, USAF, domínio público](https://commons.wikimedia.org/wiki/File:Halt_Memorandum.jpg) e [foto posterior do portão leste de RAF Woodbridge, Taras Young, CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:RAF_Woodbridge_East_Gate.jpg). |
| Washington | [“Saucers over Washington”, U.S. National Archives](https://prologue.blogs.archives.gov/2019/12/19/saucers-over-washington-the-history-of-project-blue-book/) e [gráfico do Project Blue Book, U.S. National Archives, domínio público](https://commons.wikimedia.org/wiki/File:Appendix_I_to_Project_Blue_Book_Status_Report_Number_8_-_NARA_-_595542.jpg). |

As coordenadas em `src/sightings.js` são referências aproximadas. As imagens e os relatos não estabelecem a origem dos fenômenos.

## Mapa

- Mapa diurno: [NASA/Goddard Space Flight Center Scientific Visualization Studio, Blue Marble](https://svs.gsfc.nasa.gov/2915/).
- Luzes noturnas: [NASA Earth Observatory, Earth at Night 2012](https://svs.gsfc.nasa.gov/30028/).
- Nuvens: [NASA Visible Earth, Blue Marble: Clouds](https://www.visibleearth.nasa.gov/images/57747/blue-marble-clouds).
- Fronteiras: [Natural Earth, Admin 0 Boundary Lines (50m)](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-boundary-lines-2/).
- Posição solar: [NOAA, General Solar Position Calculations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF).
