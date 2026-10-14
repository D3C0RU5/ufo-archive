# Orbital

Mapa interativo de quatro relatos de avistamentos. O globo WebGL pode ser girado com mouse, toque ou teclado e oferece os modos Satélite, Atlas e Holograma. Ao selecionar um ponto ou um item da lista, o painel ao lado mostra data, local, resumo, imagens relacionadas e fonte. Em telas estreitas, o painel aparece abaixo do mapa.

O botão **Período**, acima do globo, abre atalhos para os períodos com relatos e uma opção de intervalo personalizado. Nela, escolha o ano e, se quiser, refine por mês e dia; qualquer um dos limites pode ficar vazio. **Todos** restaura o arquivo completo. A lista e os pontos do mapa acompanham o intervalo. Relatos sem dia exato usam o mês ou ano documentado para verificar se coincidem com o intervalo escolhido.

O zoom vai de 100% a 500% pelos botões do mapa, pela roda do mouse ou por pinça em telas sensíveis ao toque. Os pontos acompanham a ampliação e podem sair da área visível; gire o globo para trazer outras regiões ao centro.
Ao passar de 150%, o globo carrega mapas diurno e noturno com mais detalhes. Usa versões de 8192×4096 pixels em telas maiores com suporte da GPU e de 4096×2048 pixels em telas menores; se o carregamento falhar, mantém os mapas leves.

Ao carregar, o navegador consulta [ipwho.is](https://ipwhois.io/documentation) para obter uma localização aproximada pelo IP público. O globo gira até essa posição e a mostra em azul vivo; o botão **Minha posição** volta a centralizá-la. A precisão depende do provedor de internet e pode corresponder à cidade ou região. Se a consulta falhar, o mapa continua disponível sem o marcador. O serviço recebe o IP público do visitante e a versão gratuita tem limite de requisições por domínio.

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

- Mapa diurno: [NASA Blue Marble, imagem original em 8192×4096](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_8192.tif).
- Luzes noturnas: [NASA Earth Observatory, Earth at Night 2012](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/).
- Nuvens: [NASA Visible Earth, Blue Marble: Clouds](https://www.visibleearth.nasa.gov/images/57747/blue-marble-clouds).
- Fronteiras: [Natural Earth, Admin 0 Boundary Lines (50m)](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-boundary-lines-2/).
- Posição solar: [NOAA, General Solar Position Calculations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF).
