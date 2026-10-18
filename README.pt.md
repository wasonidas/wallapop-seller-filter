# Filtros de vendedores para Wallapop

[English](README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · Português

Extensão local e de código aberto para **Chrome e Edge**. Filtra resultados carregados pelo número de avaliações do vendedor e por provas explícitas de verificação de identidade. Manifest V3, JavaScript, licença MIT. Sem backend, telemetria, subscrições ou chamadas a IA.

**Âmbito atual:** apenas `https://es.wallapop.com/`. A interface continua em espanhol. As traduções do README não acrescentam outros domínios Wallapop nem traduzem a extensão. Projeto independente, sem afiliação à Wallapop.

## Instalação

1. Neste repositório, escolha **Code → Download ZIP** e extraia o arquivo para uma pasta permanente.
2. Na barra de endereços do **Google Chrome**, escreva `chrome://extensions`. No **Microsoft Edge**, use `edge://extensions`. Utilize o navegador, não o Explorador de Ficheiros do Windows.
3. Ative o **Modo de programador** e escolha **Carregar expandida / Carregar sem compactação**.
4. Selecione a pasta **`extension`**, por exemplo `wallapop-seller-filter-main/extension`. A raiz dessa pasta deve conter `manifest.json`. Não selecione Documentos nem a raiz do repositório.
5. Abra uma pesquisa na [Wallapop Espanha](https://es.wallapop.com/) e recarregue o separador se já estava aberto. O painel **Reputación del vendedor** aparece acima dos resultados.

Não precisa de Node.js nem de assistentes de desenvolvimento para utilizar a extensão. Depois de compilar, também pode carregar a pasta gerada `dist`.

## Utilização

- **Filtrado activo:** filtragem inicialmente ativa e estrita; ao desativar, os anúncios reaparecem sem recarregar.
- **Mínimo de reseñas:** mínimo inicial de 5 avaliações. O critério é **número de avaliações ≥ mínimo**: exatamente 5 cumpre um mínimo de 5. É o total geral do perfil, não as estrelas nem apenas avaliações de vendas.
- **Solo identidad verificada:** exige prova explícita de identidade pessoal. Verificação comercial e ausência de distintivo ficam como desconhecidas.
- **Mostrar sin comprobar:** mostra também anúncios pendentes, desconhecidos e com erros, devidamente identificados.
- **Comprobar 10 más:** processa até dez URL ainda não tentados. Depois do primeiro lote, a continuação é manual.
- **Reintentar errores:** tenta novamente até dez URL com falhas, sem limpar a cache nem repetir resultados conhecidos ou desconhecidos.
- **Actualizar datos:** limpa a cache partilhada e processa novamente até dez anúncios.
- **Reanudar consultas:** retoma manualmente após um limite ou bloqueio de acesso.

Os contadores separam correspondências, exclusões, pedidos em curso, anúncios ainda não tentados, dados desconhecidos e erros. **Processado não significa verificado.** Quando todos os anúncios carregados foram processados, o botão de continuação é desativado, mesmo que existam dados desconhecidos.

Os anúncios ocultos mantêm o espaço e a ordem para não deslocar os mecanismos de carregamento ao deslocar a página. Só se filtram **resultados carregados e processados**, não todo o catálogo. Zero correspondências confirmadas com dados incompletos não demonstra ausência de vendedores adequados.

## Pedidos e privacidade

Um pedido de cada vez entre separadores, pelo menos três segundos entre inícios e dez URL distintos por lote. A extensão lê o HTML dos anúncios ligados, sem inventar endpoints de API nem descarregar código executável remoto.

Cache local válida durante 24 horas: ID do vendedor, número de avaliações, prova de identidade, data, URL de origem e associações anúncio-vendedor. As entradas expiradas são eliminadas ao aceder à cache, não através de uma eliminação agendada. Também se guardam preferências e estado de pausa. Não se inspecionam nem guardam valores de cookies ou credenciais, nem se conservam nomes, telefones ou textos de avaliações. Os pedidos normais à Wallapop podem incluir os cookies de sessão geridos pelo navegador.

Permissões: `storage` e `https://es.wallapop.com/*`. HTTP 429 pausa os pedidos e respeita `Retry-After`; 401/403 e CAPTCHA interrompem-nos até uma ação manual. Erros nunca são guardados como zero avaliações. Dois anúncios novos da mesma pessoa podem exigir duas leituras para descobrir a associação; as associações conhecidas reutilizam a cache do vendedor.

## Atualizar, desenvolver e limitações

Substitua a pasta permanente, recarregue a extensão na página das extensões e depois a Wallapop. As preferências mantêm-se numa recarga normal. Para desinstalar, escolha **Remover** e recarregue os separadores abertos.

Versões de Node.js em `package.json`. O núcleo não precisa de pacotes adicionais:

```sh
npm run check
npm test
npm run build
```

São gerados `dist/` e `wallapop-seller-filters.zip`, com manifesto e licença MIT na raiz. Testes opcionais do navegador:

```sh
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

`BROWSER_EXECUTABLE` e `PLAYWRIGHT_MODULE` permitem escolher instalações existentes. Os testes usam um perfil separado, depuração limitada à máquina local e respostas intercetadas; não consultam a Wallapop. CI executa sintaxe, testes do núcleo e compilação. Os testes do navegador são separados.

Foram comparados três anúncios e perfis reais; um utilizador mostrou a filtragem no Chrome. Falta comparar vários perfis nesse navegador e executar os testes no Edge. Os fixtures não comprovam a integração real. Consulte [testes](docs/TESTING.md), [investigação](docs/RESEARCH.md) e [manutenção](docs/MAINTENANCE.md).

Contribuições e traduções: [CONTRIBUTING.md](CONTRIBUTING.md). Não publique dados de sessão nem capturas sem anonimização.

[Licença MIT](LICENSE) · Copyright © 2026 wasonidas.
