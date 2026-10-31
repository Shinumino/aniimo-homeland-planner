// Page language: English (the page's own words) or Portuguese (user, 2026-09-28: "only English and
// Portuguese"). Game names come from the game's Portuguese text (data.js i18n.pt, matched by game ids);
// the page's own words are translated here by hand into Brazilian Portuguese, using the game's terms
// (RV = Motorhome, Home Coin = Moeda do Lar, Level = Nível) so the page reads like the game.
// The planner keeps English names as its keys: only what is shown changes.
(function (root) {
  const PT = {
    // ---- static page text (every text piece of index.html; keys are the English, whitespace collapsed)
    "Aniimo Homeland Planner": "Planejador do Lar Aniimo",
    "Your RV": "Seu Motorhome",
    "RV level": "Nível do Motorhome",
    "Changing the RV sets every limit below to what that RV allows. Everything stays editable.":
      "Mudar o Motorhome ajusta todos os limites abaixo ao que esse nível permite. Tudo continua editável.",
    "Fill everything to this RV's max (counts too)": "Preencher tudo com o máximo deste Motorhome (quantidades também)",
    "Aniimo": "Aniimo",
    "Aniimo cap in your home": "Limite de Aniimo no seu Lar",
    "Kept out of production (e.g. star farming)": "Fora da produção (ex.: farm de estrelas)",
    "Haulers (Hauling ability)": "Carregadores (habilidade Transporte)",
    "Aniimo that eat (blank = cap)": "Aniimo que comem (vazio = limite)",
    "Only feed food worth at least (per item)": "Só dar comida que valha pelo menos (por item)",
    "Energy Bites give 1,000; cooked dishes like Soy Sauce Fried Rice give ~45,000, so you refill far less often.":
      "Petiscos de Energia dão 1.000; pratos cozidos como Arroz Frito com Shoyu dão ~45.000, então você repõe bem menos vezes.",
    "Your Aniimo's ability level goes up to": "O nível de habilidade dos seus Aniimo vai até",
    "Level 1": "Nível 1",
    "Level 2 and below": "Nível 2 ou menos",
    "Level 3 and below": "Nível 3 ou menos",
    "Level 4 and below": "Nível 4 ou menos",
    "Each job gets your best Aniimo. A job that needs a higher level still runs, just slower; on many benches one level above the requirement works 3x faster.":
      "Cada trabalho recebe seu melhor Aniimo. Um trabalho que pede nível maior ainda roda, só que mais devagar; em muitas bancadas um nível acima do pedido trabalha 3x mais rápido.",
    "Assume every worker's personality matches its bench (+20%)": "Considerar que a personalidade de cada trabalhador combina com a bancada (+20%)",
    "Facilities that lock an Aniimo full time": "Instalações que prendem um Aniimo o tempo todo",
    "These keep their Aniimo until the output is full, so each one uses a whole Aniimo.":
      "Elas seguram o Aniimo até a produção encher, então cada uma usa um Aniimo inteiro.",
    "Facilities": "Instalações",
    "How many of each you have and their level. \"/N\" is the most your RV allows.":
      "Quantas de cada você tem e o nível delas. \"/N\" é o máximo que seu Motorhome permite.",
    "Facility": "Instalação",
    "Count": "Qtd.",
    "Level": "Nível",
    "RV modules": "Módulos do Motorhome",
    "Environment devices": "Dispositivos de ambiente",
    "Let the planner place Heat Furnaces, Cooling Units and Sunlamps": "Deixar o planejador colocar Fornos de Calor, Resfriadores e Lâmpadas Solares",
    "It picks how many (up to your RV's limit), the setting, and which crops go under them. A plot counts if any part of it is inside a device's area. Plots one device reaches, with the plots packed around it:":
      "Ele escolhe quantos (até o limite do seu Motorhome), o ajuste e quais plantações ficam sob eles. Um lote conta se qualquer parte dele estiver dentro da área do dispositivo. Lotes que um dispositivo alcança, com os lotes juntos em volta dele:",
    "Farmland plots under one device": "Lotes de Fazenda sob um dispositivo",
    "Woodland plots under one device": "Lotes de Bosque sob um dispositivo",
    "Options": "Opções",
    "One recipe per bench (set it and leave it). Untick if you switch bench recipes by hand":
      "Uma receita por bancada (configura e deixa). Desmarque se você troca as receitas na mão",
    "Crops are watered (−5 min per growth stage; needs a free Water Aniimo)":
      "Plantações regadas (−5 min por estágio de crescimento; precisa de um Aniimo de Água livre)",
    "Plan food for the Aniimo (unfed Aniimo work at 20% speed)": "Planejar comida para os Aniimo (Aniimo sem comida trabalham a 20% da velocidade)",
    "Event seeds can be bought": "Sementes de evento podem ser compradas",
    "Walking time per crop task (min)": "Tempo de caminhada por tarefa de plantação (min)",
    "Recipe Notes you own": "Notas de Receita que você tem",
    "Not in the game yet": "Ainda não estão no jogo",
    "Visits are counted anonymously with GoatCounter (no cookies).": "As visitas são contadas de forma anônima pelo GoatCounter (sem cookies).",
    "Ticked Aniimo are never planned, listed or suggested. Untick one when it comes out.":
      "Aniimo marcados nunca são planejados, listados ou sugeridos. Desmarque quando ele sair.",
    "Make for yourself": "Fazer para você",
    "Tick what you make for yourself. That facility is set to it and makes it whenever the ingredients are in storage; the plan uses everything else for coin.":
      "Marque o que você faz para você. Essa instalação fica nisso e faz sempre que os ingredientes estão no armazém; o plano usa todo o resto para ganhar moedas.",
    "from {0}": "com {0}",
    "Up to {0} an hour; the plan sets aside {1}.": "Até {0} por hora; o plano separa {1}.",
    "{0}/h of {1}": "{0}/h de {1}",
    "{0} {1}: tick up to {0}.": "{0} {1}: marque até {0}.",
    "No Aniipod Maker or Dance Pad Polisher in your layout.": "Nenhum Fabricante de Aniicápsula ou Jogo de Dança Lapidador no seu layout.",
    "{0}: {1}, whenever its ingredients are in storage (not in the coin plan).": "{0}: {1}, sempre que os ingredientes estão no armazém (fora do plano de moedas).",
    "Next RV level": "Próximo nível do Motorhome",
    "Upgrade to RV": "Melhorar para o Motorhome",
    "Plan for the fastest upgrade (instead of the most coin)": "Planejar a melhoria mais rápida (em vez da maior renda)",
    // orders (user, 2026-10-18)
    "Orders": "Pedidos",
    "New orders come at 4:00 and 16:00, each asking for one item. Ticked, the plan makes as many of the items orders ask for as it can, the most asked first; then the most coin, or the fastest upgrade if that is ticked.":
      "Pedidos novos chegam às 4:00 e às 16:00, cada um pedindo um item. Marcado, o plano faz o máximo de itens que os pedidos pedem, os mais pedidos primeiro; depois a maior renda, ou a melhoria mais rápida se ela estiver marcada.",
    "Plan to fill the most orders (coin comes second)": "Planejar para atender o máximo de pedidos (a renda vem depois)",
    "Season orders too (while the season runs)": "Pedidos da temporada também (enquanto a temporada durar)",
    "Season orders a day (blank = the game's number)": "Pedidos da temporada por dia (vazio = o número do jogo)",
    "Fills about {0} of orders ({1} of {2} items); without this tick box, {3}.": "Atende cerca de {0} dos pedidos ({1} de {2} itens); sem esta opção, {3}.",
    "It costs {0} coin/h of sales: {1} instead of {2}.": "Custa {0} moedas/h de vendas: {1} em vez de {2}.",
    "It costs no coin.": "Não custa moedas.",
    "{0} new orders a day.": "{0} pedidos novos por dia.",
    "{0} new orders a day, {1} of them season orders.": "{0} pedidos novos por dia, {1} deles da temporada.",
    "Orders it can fill:": "Pedidos que ele atende:",
    "Needs the Recipe Note {0}:": "Precisa da Nota de Receita {0}:",
    "Needs {0} level {1}:": "Precisa de {0} nível {1}:",
    "Found in the wild, not made at home:": "Achados na natureza, não feitos em casa:",
    "Its seed cannot be bought:": "A semente não pode ser comprada:",
    "Turned off under Recipes you have:": "Desmarcados em Receitas que você tem:",
    "Needs {0}:": "Precisa de {0}:",
    "Made, but it goes into {0}:": "Feito, mas vai para {0}:",
    "Grown, but it goes into {0}:": "Cultivado, mas vai para {0}:",
    "{0} already goes to {1}:": "{0} já vai para {1}:",
    "Not filled by this plan:": "Este plano não atende:",
    "Benches may share an ingredient (fills more orders)": "Bancadas podem dividir um ingrediente (atende mais pedidos)",
    "Each bench keeps one recipe, but two or more benches can use the same ingredient. In the game the first free bench takes it, so what those benches make is an estimate.":
      "Cada bancada fica com uma receita, mas duas ou mais bancadas podem usar o mesmo ingrediente. No jogo, a primeira bancada livre fica com ele, então o que essas bancadas fazem é uma estimativa.",
    "Share at most this many ingredients (blank = no limit, 0 = none)": "Dividir no máximo esta quantidade de ingredientes (vazio = sem limite, 0 = nenhum)",
    "These benches share an ingredient.": "Estas bancadas dividem um ingrediente.",
    "In the game the first free bench takes it, so how much each makes, the coin per hour and the orders under \"If the split allows\" can differ from what you see.":
      "No jogo, a primeira bancada livre fica com ele, então quanto cada uma faz, a renda por hora e os pedidos em \"Se a divisão permitir\" podem ser diferentes do que você vê.",
    "If the split allows:": "Se a divisão permitir:",
    "Raise \"Share at most\" to fill more.": "Aumente \"Dividir no máximo\" para atender mais.",
    "shares {0}": "divide {0}",
    "Sharing ingredients could not be planned in time: this is the plan without it.": "Não deu tempo de planejar com ingredientes divididos: este é o plano sem isso.",
    "Recipe Note {0}": "Nota de Receita {0}",
    "{0} level {1}": "{0} nível {1}",
    "found in the wild": "achado na natureza",
    "{0} cannot be bought:": "Não dá para comprar {0}:",
    "turned off": "desmarcado",
    "Untick One recipe per bench (Assumptions) to fill more, if you switch bench recipes by hand.":
      "Desmarque Uma receita por bancada (Premissas) para atender mais, se você troca as receitas na mão.",
    // the layout of 2026-10-19: six settings groups, folded parts, one set of roster names
    "Your homeland": "Seu lar",
    "Goal": "Objetivo",
    "What you can make": "O que você pode fazer",
    "Your Aniimo": "Seus Aniimo",
    "Assumptions": "Premissas",
    "Event seeds you can buy": "Sementes de evento que você pode comprar",
    "Food": "Comida",
    "Plots one device reaches": "Lotes que um dispositivo alcança",
    "{0} below RV {1}'s max": "{0} abaixo do máximo do Motorhome {1}",
    "everything RV {0} allows": "tudo o que o Motorhome {0} permite",
    "What RV {0} needs, step by step": "O que o Motorhome {0} pede, passo a passo",
    "Orders: {0} filled": "Pedidos: {0} atendidos",
    "Why the other {0} are not filled": "Por que os outros {0} não são atendidos",
    "RV {0} in {1}": "Motorhome {0} em {1}",
    "Your setup: RV {0} · goal: {1}": "Sua configuração: Motorhome {0} · objetivo: {1}",
    "orders, then the fastest upgrade": "pedidos, depois a melhoria mais rápida",
    "orders, then coin": "pedidos, depois renda",
    "the fastest upgrade": "a melhoria mais rápida",
    "the most coin": "a maior renda",
    "That coin is from a separate plan made for the best Aniimo; the roster below is for the plan on this page.":
      "Essa renda vem de um plano à parte, feito para os melhores Aniimo; a equipe abaixo é para o plano desta página.",
    "The orders focus needs the HiGHS solver, which did not load: this is the plan without it.":
      "O foco em pedidos precisa do resolvedor HiGHS, que não carregou: este é o plano sem ele.",
    // fewest Aniimo (2026-10-24): the tick under Goal and its table
    "Use as few Aniimo as possible": "Usar o mínimo de Aniimo possível",
    "Power runs machines in their place, and the goal above stays the same. Pick a row in the Fewer Aniimo table to give up coin for fewer Aniimo.":
      "A energia faz as máquinas funcionarem no lugar deles, e o objetivo acima continua o mesmo. Escolha uma linha na tabela Menos Aniimo para trocar renda por menos Aniimo.",
    "Fewer Aniimo": "Menos Aniimo",
    "Click a row to use that plan.": "Clique numa linha para usar esse plano.",
    "Aniimo working": "Aniimo trabalhando",
    "Home Coin / hour": "Moedas do Lar / hora",
    "Change": "Diferença",
    "no coin lost": "sem perder renda",
    "no power": "sem energia",
    "1 generator runs {0} machines": "1 gerador move {0} máquinas",
    "{0} generators run {1} machines": "{0} geradores movem {1} máquinas",
    "Working out the next row…": "Calculando a próxima linha…",
    "under 0.1%": "menos de 0,1%",
    "Stops here: one Aniimo fewer would lose more than 10% of the coin.": "Para aqui: um Aniimo a menos perderia mais de 10% da renda.",
    "Stops here: with one Aniimo fewer the goal cannot be kept.": "Para aqui: com um Aniimo a menos o objetivo não se mantém.",
    "The next row could not be planned.": "A próxima linha não pôde ser planejada.",
    "Stops here: the next row could not be worked out in time.": "Para aqui: a próxima linha não foi calculada a tempo.",
    "The fewest Aniimo was not found within {0} s: the table starts at this plan's own Aniimo.":
      "O mínimo de Aniimo não foi encontrado em {0} s: a tabela começa nos Aniimo deste plano.",
    "The fewest Aniimo could not be planned: the table starts at this plan's own Aniimo.":
      "Não foi possível planejar o mínimo de Aniimo: a tabela começa nos Aniimo deste plano.",
    "Your pick of {0} Aniimo cannot keep the goal: this is the first row.": "Sua escolha de {0} Aniimo não mantém o objetivo: esta é a primeira linha.",
    "Your pick of {0} Aniimo could not be worked out in time: this is the first row.": "Sua escolha de {0} Aniimo não foi calculada a tempo: esta é a primeira linha.",
    "Your pick of {0} Aniimo could not be planned: this is the first row.": "Não foi possível planejar sua escolha de {0} Aniimo: esta é a primeira linha.",
    "{0} Aniimo working": "{0} Aniimo trabalhando",
    "fewest Aniimo": "menos Aniimo",
    "The fewest Aniimo needs the HiGHS solver, which did not load: this is the plan without it.":
      "O mínimo de Aniimo precisa do resolvedor HiGHS, que não carregou: este é o plano sem ele.",
    "The orders could not be planned: this is the plan without the orders focus.":
      "Não foi possível planejar os pedidos: este é o plano sem o foco em pedidos.",
    "Recipes you have": "Receitas que você tem",
    "Everything your facilities, modules and notes allow. Untick what you don't have.":
      "Tudo que suas instalações, módulos e notas permitem. Desmarque o que você não tem.",
    "Tick all": "Marcar todas",
    "Untick all": "Desmarcar todas",
    "Save & share": "Salvar e compartilhar",
    "Save setup to file": "Salvar configuração em arquivo",
    "Load setup file": "Carregar arquivo de configuração",
    "Reset to defaults": "Voltar ao padrão",
    "Your setup is also remembered in this browser.": "Sua configuração também fica salva neste navegador.",
    "Aniimo budget": "Aniimo disponíveis",
    "The plan": "O plano",
    "How many of each facility to set to each recipe, and how busy a bench is. Coin/h is what that row's product earns after its ingredients; a row that feeds another row shows where it goes. The rows and the lines under the table add up to the total at the top.":
      "Quantas de cada instalação colocar em cada receita e o quanto cada bancada fica ocupada. Moedas/h é o que o produto da linha rende depois dos ingredientes; uma linha que abastece outra mostra para onde vai. As linhas e os itens abaixo da tabela somam o total lá em cima.",
    "{0} takes {1} {2}/h": "{0} usa {1} {2}/h",
    "Aniimo eat {0} {1}/h": "Aniimo comem {0} {1}/h",
    "Left in storage: {0} {1}/h": "Fica no armazém: {0} {1}/h",
    "Total": "Total",
    "How many": "Quantos",
    "Makes each cycle": "Faz por ciclo",
    "What to put": "O que colocar",
    "Advanced mode": "Modo avançado",
    "Simple mode": "Modo simples",
    "Minimum roster": "Equipe mínima",
    "Ideal roster": "Equipe ideal",
    "Put it on": "Coloque em",
    "That file is not a setup file.": "Esse arquivo não é uma configuração salva.",
    "Do not add more machines: it slows all of them.": "Não adicione mais máquinas: isso deixa todas mais lentas.",
    "Per hour": "Por hora",
    "Cycle": "Ciclo",
    "Coin/h": "Moedas/h",
    "Worker": "Trabalhador",
    "Environment devices to place": "Dispositivos de ambiente para colocar",
    "Sell per hour": "Vender por hora",
    "Aniimo you need": "Aniimo que você precisa",
    "Job": "Trabalho",
    "Full time": "Tempo integral",
    "Aniimo that can do it": "Aniimo que conseguem fazer",
    "Full-time workers per job type, and the Aniimo that can do it (best level first; a level above the requirement is much faster on many benches). The letter is the personality that gives +20% on that bench. Crop work (planting, watering, harvest) is shared by the rest of your Aniimo.":
      "Trabalhadores em tempo integral por tipo de trabalho e os Aniimo que conseguem fazer (melhor nível primeiro; um nível acima do pedido é bem mais rápido em muitas bancadas). A letra é a personalidade que dá +20% naquela bancada. O trabalho nas plantações (plantar, regar, colher) é dividido pelo resto dos seus Aniimo.",
    "The fewest Aniimo that cover all the work. Full-time jobs get their own Aniimo; part-time jobs are grouped on Aniimo that can do several of them.":
      "O menor número de Aniimo que cobre todo o trabalho. Trabalhos em tempo integral ganham um Aniimo só para eles; trabalhos de meio período ficam juntos em Aniimo que fazem vários deles.",
    "Ideal personality": "Personalidade ideal",
    ": the letters that give +20% on its benches (one letter per pair E/I, S/N, T/F, J/P; ? = does not matter).":
      ": as letras que dão +20% nas bancadas dele (uma letra por par E/I, S/N, T/F, J/P; ? = tanto faz).",
    "Alternatives": "Alternativas",
    ": other Aniimo that can do all the same jobs, best first, if you don't have the suggested one.":
      ": outros Aniimo que fazem os mesmos trabalhos, os melhores primeiro, se você não tiver o sugerido.",
    "Best case": "Melhor caso",
    "Include Prismana Aniimo": "Incluir Aniimo Prismana",
    "Food eaten per hour": "Comida consumida por hora",
    "Seeds to buy per hour": "Sementes para comprar por hora",

    // ---- text built by the page ({0}, {1}... are filled in)
    "Language": "Idioma",
    "RV {0}: {1} in the home + {2} in the RV Park (Signal Transmitter) = {3}": "Motorhome {0}: {1} no Lar + {2} no Estacionamento do Motorhome (Transmissor de Sinal) = {3}",
    "RV {0}": "Motorhome {0}",
    "unlocks at RV {0}": "libera no Motorhome {0}",
    "none": "nenhum",
    "Lv {0}": "Nv. {0}",
    " (RV {0})": " (Motorhome {0})",
    "Not out: {0}": "Ainda não saíram: {0}",
    "All Aniimo are in the game": "Todos os Aniimo estão no jogo",
    "{0} per day": "{0} por dia",
    "note": "nota",
    "keep": "guardar",
    "No plan": "Sem plano",
    "optimal": "ótimo", "infeasible": "impossível", "unbounded": "sem limite", "iteration_limit": "limite de iterações", "time_limit": "tempo esgotado",
    "{0} Home Coin / hour": "{0} Moedas do Lar / hora",
    "{0} per day · solved in {1} ms ({2})": "{0} por dia · resolvido em {1} ms ({2})",
    "built-in": "próprio",
    " · best found in {0} s": " · melhor encontrado em {0} s",
    "{0} of {1} production Aniimo busy": "{0} de {1} Aniimo de produção ocupados",
    "cap {0} − kept out {1} − haulers {2}": "limite {0} − fora da produção {1} − carregadores {2}",
    "locked facilities {0}": "instalações presas {0}",
    "environment devices {0}": "dispositivos de ambiente {0}",
    "benches {0}": "bancadas {0}",
    "crop tasks {0}": "tarefas de plantação {0}",
    "{0} {1}, set to {2}": "{0} {1}, na configuração {2}",
    "Place it over: {0}": "Coloque sobre: {0}",
    "{0} {1} of {2}": "{0} {1} de {2}",
    "turned off": "desligado",
    "Use power: machines in E-mode on Crackle Generators (Power Module, RV 12)": "Usar energia: máquinas no modo E com Geradores de Estalos (Módulo de Energia, Motorhome 12)",
    "Power": "Energia",
    "no generator yet (Power Module, RV 12)": "ainda sem gerador (Módulo de Energia, Motorhome 12)",
    "{0} {1} level {2}": "{0} {1} nível {2}",
    "Connect: {0}": "Ligar: {0}",
    "{0} {1} on {2}": "{0} {1} em {2}",
    "Power used {0} of {1}: every machine at 120%. Do not add more machines: drawing more than {2} slows all of them.":
      "Energia usada {0} de {1}: todas as máquinas a 120%. Não ligue mais máquinas: puxar mais de {2} deixa todas mais lentas.",
    "Link the generators into one network with power poles.": "Ligue os geradores numa só rede com postes de energia.",
    "E-mode": "Modo E",
    "In E-mode on the generators: no Aniimo needed.": "No modo E nos geradores: não precisa de Aniimo.",
    "no Aniimo": "sem Aniimo",
    "generators {0}": "geradores {0}",
    "by hand {0}": "à mão {0}",
    "Farmland": "Fazenda",
    "Woodland": "Bosque",
    "Keep each plot under one device: where two areas overlap, their temperatures add up (Warm + Cool = none).": "Deixe cada lote sob um só dispositivo: onde duas áreas se sobrepõem, as temperaturas se somam (Morno + Fresco = nada).",
    "{0} grows at {1}% here.": "{0} cresce a {1}% aqui.",
    "Power did not give a better plan within {0} s: this is the plan without it.": "A energia não deu um plano melhor em {0} s: este é o plano sem ela.",
    "{0} level {1} needs {2} level {1}: planning with level {3}.": "{0} nível {1} precisa do {2} nível {1}: planejando com o nível {3}.",
    "none worth placing": "nenhum vale a pena",
    // base layout panel
    "Base layout": "Planta da base",
    "One arrangement that works: each device's area (dashed square) with the plots that must touch it. Any arrangement with the same plots touching the area gives the same plan. Keep the areas apart, so each plot is under one device.":
      "Uma disposição que funciona: a área de cada dispositivo (quadrado tracejado) com os lotes que precisam tocá-la. Qualquer disposição com os mesmos lotes tocando a área dá o mesmo plano. Mantenha as áreas separadas, para cada lote ficar sob um só dispositivo.",
    "Did not fit in the drawing: {0}. The coverage you entered is above what fits around one device.":
      "Não coube no desenho: {0}. O alcance que você informou é maior do que cabe em volta de um dispositivo.",
    "Plot counts rounded for the drawing.": "Quantidade de lotes arredondada para o desenho.",
    "No room left in this area for: {0}.": "Não sobrou espaço nesta área para: {0}.",
    "{0}: the game asks for {1}, but you can ignore it. Its timer is the same with or without a {2}.":
      "{0}: o jogo pede {1}, mas você pode ignorar. O tempo é o mesmo com ou sem {2}.",
    "What makes it faster is an Aniimo with the {0} personality.": "O que deixa mais rápido é um Aniimo com a personalidade {0}.",
    "Everything the plan uses, placed on your open plots: nothing overlaps, each climate plot is under its own device only, E-mode machines are on the power network, and the facilities one Aniimo works and the Storage Units are kept close to cut walking. One good arrangement, not the only one; the plan's numbers do not depend on it.":
      "Tudo o que o plano usa, posicionado nos seus terrenos abertos: nada se sobrepõe, cada lote com clima fica só sob o seu dispositivo, as máquinas no Modo E ficam na rede de energia, e as instalações de um mesmo Aniimo e os Depósitos ficam perto para reduzir a caminhada. Uma boa disposição, não a única; os números do plano não dependem dela.",
    "Device areas": "Áreas dos dispositivos",
    "Map of where everything goes. Click to open.": "Mapa de onde colocar tudo. Clique para abrir.",
    "Other facilities": "Outras instalações",
    "Device area": "Área do dispositivo",
    "Power area": "Área de energia",
    "Generator and poles": "Gerador e postes",
    "1 square = 1 tile; darker lines every 5": "1 quadrado = 1 quadradinho; linhas mais escuras a cada 5",
    "1 Storage Unit (the most RV {0} allows).": "1 Depósito (o máximo que o Motorhome {0} permite).",
    "1 Storage Unit: RV {0} allows {1}, but there is no room for more.": "1 Depósito: o Motorhome {0} permite {1}, mas não há espaço para mais.",
    "1 E-mode machine could not be linked to the power network with the poles this RV allows.": "1 máquina no Modo E não pôde ser ligada à rede com os postes que este Motorhome permite.",
    "No size known for: {0}.": "Tamanho desconhecido para: {0}.",
    "Placing everything on the map…": "Posicionando tudo no mapa…",
    "Storage Unit": "Depósito",
    "{0} open plots of 20 × 15 (RV {1}).": "{0} terrenos abertos de 20 × 15 (Motorhome {1}).",
    "{0} Storage Units (the most RV {1} allows).": "{0} Depósitos (o máximo que o Motorhome {1} permite).",
    "1 power pole links the E-mode machines to the power network.": "1 poste de energia liga as máquinas no Modo E à rede de energia.",
    "{0} power poles link the E-mode machines to the power network.": "{0} postes de energia ligam as máquinas no Modo E à rede de energia.",
    "{0} Storage Units: RV {1} allows {2}, but there is no room for more.": "{0} Depósitos: o Motorhome {1} permite {2}, mas não há espaço para mais.",
    "Haulers walk about {0} min an hour to the nearest Storage Unit and back (Aniimo walk 3 tiles a second; a level-1 hauler carries 60 items a trip). For information only: the plan's numbers do not include it.":
      "Os carregadores andam cerca de {0} min por hora até o Depósito mais próximo e de volta (os Aniimo andam 3 quadradinhos por segundo; um carregador nível 1 leva 60 itens por viagem). Só informativo: os números do plano não incluem isso.",
    "Did not fit on the open land: {0}.": "Não coube nos terrenos abertos: {0}.",
    "{0} E-mode machines could not be linked to the power network with the poles this RV allows.": "{0} máquinas no Modo E não puderam ser ligadas à rede com os postes que este Motorhome permite.",
    "Plots without a device": "Lotes sem dispositivo",
    "Other facilities: their position does not change the plan": "Outras instalações: a posição delas não muda o plano",
    "plot": "lote", "plots": "lotes",
    "bench": "bancada", "benches": "bancadas",
    "busy {0}": "ocupada {0}",
    "exact: {0}": "exato: {0}",
    "{0} min": "{0} min",
    "{0}/day": "{0}/dia",
    "nothing": "nada",
    "food planning is off": "planejamento de comida desligado",
    "Each item fed lasts about {0} min for {1} Aniimo · a stack of 99 about {2} h":
      "Cada item dura cerca de {0} min para {1} Aniimo · uma pilha de 99 dura cerca de {2} h",
    "{0} food": "{0} de comida",
    "{0} coin": "{0} moedas",
    "+{0} more": "+{0} mais",
    "none: only this Aniimo does all these jobs": "nenhuma: só este Aniimo faz todos esses trabalhos",
    "{0} abilities": "{0} habilidades",
    "any (no bench bonus for these jobs)": "qualquer uma (sem bônus de bancada nesses trabalhos)",
    "+20% on {0}% of its work": "+20% em {0}% do trabalho dele",
    "{0} is the recommended personality, but this Aniimo can't have it: use the alternatives →":
      "{0} é a personalidade recomendada, mas este Aniimo não pode ter: use as alternativas →",
    "{0}: {1} Aniimo.": "{0}: {1} Aniimo.",
    "Click a column to sort.": "Clique numa coluna para ordenar.",
    "Jobs it can do": "Trabalhos que faz",
    "Works on": "Trabalha em",
    "No Aniimo can do: {0}": "Nenhum Aniimo consegue fazer: {0}",
    "No best-case plan: {0}": "Sem plano de melhor caso: {0}",
    "{0} Home Coin / hour with the best Aniimo": "{0} Moedas do Lar / hora com os melhores Aniimo",
    "({0} / day)": "({0} / dia)",
    "{0} / hour vs your current plan": "{0} / hora contra seu plano atual",
    "{0} / hour vs your goal": "{0} / hora contra seu objetivo",
    "Same facilities, RV and options; every job gets the highest ability level that exists {0}, with a matching personality.":
      "Mesmas instalações, Motorhome e opções; cada trabalho recebe o maior nível de habilidade que existe {0}, com a personalidade certa.",
    "(Prismana forms included)": "(com formas Prismana)",
    "(without Prismana forms)": "(sem formas Prismana)",
    "level {0}": "nível {0}",
    "Game data build {0} · runs entirely on this PC": "Dados do jogo, build {0} · roda inteiro neste PC",
    "{0} family": "família {0}",
    "(watering)": "(regar)",
    "Warm +1": "Morno +1", "Scorching +2": "Escaldante +2", "Cool -1": "Fresco -1", "Cold -2": "Frio -2", "Light": "Luz",
    "Quick": "Rápida", "Premium": "Premium", "High-Speed": "Alta velocidade",
    // Next RV panel
    "RV {0} is the last level.": "O Motorhome {0} é o último nível.",
    "Home Coin": "Moeda do Lar",
    "{0} = {1} on the {2} (Lv {3}+)": "{0} = {1} na {2} (Nv. {3}+)",
    "RV {0} → {1}: {2}, {3} {4}; the upgrade then takes {5} h.": "Motorhome {0} → {1}: {2}, {3} {4}; depois a melhoria leva {5} h.",
    "Raw material: {0}": "Matéria-prima: {0}",
    "never": "nunca",
    "{0} days": "{0} dias",
    "{0} h": "{0} h",
    "Fastest plan (the plan on this page):": "Plano mais rápido (o plano desta página):",
    "ready to upgrade in {0}, then {1} h of upgrade: RV {2} in {3}.": "pronto para melhorar em {0}, depois {1} h de melhoria: Motorhome {2} em {3}.",
    "Makes per hour: {0}; sets aside {1} {2}/h of the {3}/h it earns.": "Faz por hora: {0}; separa {1} {2}/h dos {3}/h que ganha.",
    "This layout cannot make the RV {0} materials.": "Este layout não consegue fazer os materiais do Motorhome {0}.",
    "{0} at {1}/h = {2}": "{0} a {1}/h = {2}",
    "benches {0} with {1}": "bancadas {0} com {1}",
    "With this plan and the best Aniimo on the benches{0}:": "Com este plano e os melhores Aniimo nas bancadas{0}:",
    " (personality matched, +20%)": " (personalidade certa, +20%)",
    "at {0}/h": "a {0}/h",
    "Ready to upgrade in {0}, then {1} h of upgrade: RV {2} in {3}.": "Pronto para melhorar em {0}, depois {1} h de melhoria: Motorhome {2} em {3}.",
    "Not reachable with this plan: see above.": "Não dá com este plano: veja acima.",
    "Needs a free Aniimo for those benches; the plan's Aniimo count does not include them.":
      "Precisa de um Aniimo livre para essas bancadas; a contagem de Aniimo do plano não inclui eles.",
    // planner messages (translated by pattern in msg())
    "Planning…": "Planejando…",
    "Still loading... Please wait, do not press F5.": "Ainda carregando... Aguarde, não aperte F5.",
    "Still loading... This setup takes a long time to plan. Fewer ticked options plan faster.":
      "Ainda carregando... Esta configuração demora para ser planejada. Com menos opções marcadas o plano sai mais rápido.",
    "Your device took long to plan this setup: this is the best plan found in {0} s.":
      "Seu aparelho demorou para planejar esta configuração: este é o melhor plano encontrado em {0} s.",
    "error": "erro",
    "No plan with whole plots fits these Aniimo.": "Nenhum plano com lotes inteiros cabe nesses Aniimo.",
    "No plan found within {0} s. Try fewer options or a smaller layout.": "Nenhum plano encontrado em {0} s. Tente menos opções ou um layout menor.",
    "The fastest upgrade could not be planned: this is the plan for the most coin.": "Não foi possível planejar a melhoria mais rápida: este é o plano para a maior renda.",
    "No Aniimo has {0} at level 4: planned at level 3.": "Nenhum Aniimo tem {0} no nível 4: planejado no nível 3.",
    "The best roster needs {0} Aniimo but only {1} are free for work: it uses {2} of your hauler places.": "O melhor time precisa de {0} Aniimo, mas só {1} estão livres para trabalhar: ele usa {2} das vagas de carregadores.",
    "The best roster needs {0} Aniimo but only {1} are free for work: it uses {2} of the places you keep for haulers and reserved Aniimo.": "O melhor time precisa de {0} Aniimo, mas só {1} estão livres para trabalhar: ele usa {2} das vagas que você deixa para carregadores e Aniimo reservados.",
    "The best roster needs {0} Aniimo but your home has {1} places.": "O melhor time precisa de {0} Aniimo, mas sua casa tem {1} vagas.",
    "To fit your home, these jobs use a lower level: {0}.": "Para caber na sua casa, estes trabalhos usam um nível menor: {0}.",
    "This roster needs {0} Aniimo; you have {1} for production.": "Este time precisa de {0} Aniimo; você tem {1} para produção.",
    "Could not find a plan with one recipe per bench; this plan shares benches between recipes.": "Não deu para achar um plano com uma receita por bancada; este plano divide bancadas entre receitas.",
    "best found in {0} s": "melhor encontrado em {0} s",
    "No Aniimo left for production: cap - reserved - haulers is {0}.": "Nenhum Aniimo sobra para a produção: limite - fora da produção - carregadores dá {0}.",
    "{0} level {1} needs RV {2}.": "{0} nível {1} precisa do Motorhome {2}.",
    "{0} level {1} needs RV {2}: planning with level {3}.": "{0} nível {1} precisa do Motorhome {2}: planejando com o nível {3}.",
    "RV {0} allows {1} {2}, not {3}: planning with {4}.": "O Motorhome {0} permite {1} {2}, não {3}: planejando com {4}.",
    "{0} needs {1} level {2}: not planned.": "{0} precisa de {1} nível {2}: fora do plano.",
    "RV {0} allows {1} {2}: {3} not planned.": "O Motorhome {0} permite {1} {2}: {3} fora do plano.",
    "Nothing in your layout can make {0}.": "Nada no seu layout consegue fazer {0}.",
    "This layout cannot {0} with the Aniimo available. Lower a target, add facilities, or turn food planning off.":
      "Este layout não consegue {0} com os Aniimo disponíveis. Baixe uma meta, adicione instalações ou desligue o planejamento de comida.",
    "feed {0} Aniimo": "alimentar {0} Aniimo",
    "make what you asked to keep": "fazer o que você pediu para guardar",
    "work": "funcionar",
    " and ": " e ",
    "This layout cannot make the RV {0} materials: see Next RV level.": "Este layout não consegue fazer os materiais do Motorhome {0}: veja Próximo nível do Motorhome.",
    "A full-time bench must never run out of ingredients: this can leave benches unused, rule out recipes or make the plan impossible.":
      "Uma bancada em tempo integral nunca pode ficar sem ingredientes: isso pode deixar bancadas sem uso, impedir receitas ou tornar o plano impossível.",
    "A full-time bench must never run out of ingredients, and {0} cannot keep working non-stop. Untick them under Facilities that lock an Aniimo full time.":
      "Uma bancada em tempo integral nunca pode ficar sem ingredientes, e não dá para manter {0} trabalhando sem parar. Desmarque em Instalações que prendem um Aniimo o tempo todo.",
    "A full-time bench must never run out of ingredients, and {1} cannot keep working non-stop on the RV {0} materials. Untick them under Facilities that lock an Aniimo full time.":
      "Uma bancada em tempo integral nunca pode ficar sem ingredientes, e não dá para manter {1} trabalhando sem parar nos materiais do Motorhome {0}. Desmarque em Instalações que prendem um Aniimo o tempo todo.",
    "the plan makes no spare {0}": "o plano não sobra {0}",
    "no {0}": "sem {0}",
    "{0} Lv {1} needed": "precisa de {0} Nv. {1}",
    "every {0} is set to another recipe": "toda {0} está em outra receita",
  };

  // the page's language: per viewer, kept in this browser (not in the setup file you share)
  const KEY = "aniimo-planner-lang";
  let lang = "en";
  try { lang = localStorage.getItem(KEY) || ((navigator.language || "").toLowerCase().startsWith("pt") ? "pt" : "en"); } catch (e) { /* private window */ }
  if (lang !== "pt") lang = "en";

  const fill = (s, args) => s.replace(/\{(\d+)\}/g, (_, k) => (args[k] !== undefined ? args[k] : ""));
  function T(en, ...args) { return fill(lang === "pt" && PT[en] !== undefined ? PT[en] : en, args); }
  function setLang(l) { lang = l === "pt" ? "pt" : "en"; try { localStorage.setItem(KEY, lang); } catch (e) { /* ignore */ } }
  // Every number the page shows, in the chosen language, with d decimals. toLocaleString writes "-0" for float noise
  // just under zero (-1e-9) and for -0 itself, and "-0.0" with a decimal: the 2026-10-27 "-0.0%" was one call site of
  // it. So a value that rounds to zero is written as 0; a real negative keeps its sign (-0.05 is "-0.1"). Halves round
  // away from zero, as toLocaleString does (tests/rounding.test.mjs, float check 2026-10-29).
  function fmt(n, d = 0) {
    let x = Number(n);
    if (Math.abs(x) < 0.5 * 10 ** -d) x = 0;
    return x.toLocaleString(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  }

  // Game names. Every lookup takes the English key the planner uses and falls back to it.
  function names(D) {
    const pt = () => (lang === "pt" && D.i18n && D.i18n.pt) || null;
    const byName = {};
    for (const [id, it] of Object.entries(D.items)) byName[it.n] = id;
    const firstOf = {};
    for (const a of D.aniimo || []) if (!(a.n in firstOf)) firstOf[a.n] = a.id;
    const N = {
      item: (id) => { const p = pt(); return (p && p.items[id]) || (D.items[id] ? D.items[id].n : String(id)); },
      // a seed currency (Home Coin, a season's): its name in data.js currencies, and the game's pt_PT name
      currency: (id) => { const p = pt(); return (p && (p.currencies || {})[id]) || (D.currencies || {})[id] || String(id); },
      itemByName: (n) => (byName[n] ? N.item(byName[n]) : n),
      fac: (n) => { const p = pt(); return (p && p.facilities[n]) || n; },
      mod: (n) => { const p = pt(); return (p && p.modules[n]) || n; },
      ab: (n) => { const p = pt(); return (p && p.abilities[n]) || n; },
      note: (n) => { const p = pt(); return (p && p.notes[n]) || n; },
      ani: (a) => { const p = pt(); return (p && p.aniimo[a.id]) || a.n; },
      species: (n) => { const p = pt(); return (p && firstOf[n] != null && p.aniimo[firstOf[n]]) || n; },
      form: (id, en) => { const p = pt(); return (p && p.forms[id]) || en; },
      family: (fam) => { const p = pt(); return (p && p.families[fam]) || (D.families || {})[fam] || String(fam); },
      variant: (r) => { const p = pt(); return (p && p.variants[r.id]) || r.vn; },
      // "Leisure 2+ Susuta family", "Earth 1+, Water 1+ (watering)": ability names, family, watering
      job: (s) => String(s || "").split(", ").map((part) => {
        const m = /^(\S+) (\d)\+(?: (.+) family)?( \(watering\))?$/.exec(part);
        if (!m) return part;
        const famId = m[3] ? Object.keys(D.families || {}).find((k) => D.families[k] === m[3]) : null;
        return N.ab(m[1]) + " " + m[2] + "+" + (m[3] ? " " + T("{0} family", famId ? N.family(famId) : m[3]) : "") + (m[4] ? " " + T("(watering)") : "");
      }).join(", "),
      // "Heat Furnace (Warm +1)"
      zone: (s) => { const m = /^(.+) \((.+)\)$/.exec(s || ""); return m ? N.fac(m[1]) + " (" + T(m[2]) + ")" : s; },
      // planner warnings and blocked reasons: English sentences with names inside
      msg: (s) => {
        if (lang !== "pt") return s;
        const rules = [
          [/^No Aniimo has (.+) at level 4: planned at level 3\.$/, (m) => T("No Aniimo has {0} at level 4: planned at level 3.", m[1].split(", ").map((x) => N.ab(x)).join(", "))],
          [/^No plan found within (\d+) s\./, (m) => T("No plan found within {0} s. Try fewer options or a smaller layout.", m[1])],
          [/^The fewest Aniimo was not found within (\d+) s:/, (m) => T("The fewest Aniimo was not found within {0} s: the table starts at this plan's own Aniimo.", m[1])],
          [/^No Aniimo left for production: cap - reserved - haulers is (.+)\.$/, (m) => T("No Aniimo left for production: cap - reserved - haulers is {0}.", m[1])],
          [/^(.+) level (\d+) needs (.+) level \d+: planning with level (\d+)\.$/, (m) => T("{0} level {1} needs {2} level {1}: planning with level {3}.", N.fac(m[1]), m[2], (pt() && pt().modules[m[3]]) || m[3], m[4])],
          [/^(.+) level (\d+) needs RV (\d+)\.$/, (m) => T("{0} level {1} needs RV {2}.", N.fac(m[1]), m[2], m[3])],
          [/^(.+) level (\d+) needs RV (\d+): planning with level (\d+)\.$/, (m) => T("{0} level {1} needs RV {2}: planning with level {3}.", D.facilities[m[1]] ? N.fac(m[1]) : N.mod(m[1]), m[2], m[3], m[4])],
          [/^RV (\d+) allows (\d+) (.+), not (\d+): planning with (\d+)\.$/, (m) => T("RV {0} allows {1} {2}, not {3}: planning with {4}.", m[1], m[2], N.fac(m[3]), m[4], m[5])],
          [/^(.+) needs (.+) level (\d+): not planned\.$/, (m) => T("{0} needs {1} level {2}: not planned.", N.itemByName(m[1]), N.fac(m[2]), m[3])],
          [/^RV (\d+) allows (\d+) (.+): (.+) not planned\.$/, (m) => T("RV {0} allows {1} {2}: {3} not planned.", m[1], m[2], N.fac(m[3]), N.itemByName(m[4]))],
          [/^Nothing in your layout can make (.+)\.$/, (m) => T("Nothing in your layout can make {0}.", N.itemByName(m[1]))],
          [/^This layout cannot make the RV (\d+) materials: see Next RV level\.$/, (m) => T("This layout cannot make the RV {0} materials: see Next RV level.", m[1])],
          [/^A full-time bench must never run out of ingredients, and (.+) cannot keep working non-stop\. Untick them under Facilities that lock an Aniimo full time\.$/, (m) => T("A full-time bench must never run out of ingredients, and {0} cannot keep working non-stop. Untick them under Facilities that lock an Aniimo full time.",
            m[1].split(/, | and /).map(N.fac).join(", ").replace(/, ([^,]*)$/, T(" and ") + "$1"))],
          [/^A full-time bench must never run out of ingredients, and (.+) cannot keep working non-stop on the RV (\d+) materials\. Untick them under Facilities that lock an Aniimo full time\.$/, (m) => T("A full-time bench must never run out of ingredients, and {1} cannot keep working non-stop on the RV {0} materials. Untick them under Facilities that lock an Aniimo full time.",
            m[2], m[1].split(/, | and /).map(N.fac).join(", ").replace(/, ([^,]*)$/, T(" and ") + "$1"))],
          [/^This layout cannot (.+) with the Aniimo available\./, (m) => T("This layout cannot {0} with the Aniimo available. Lower a target, add facilities, or turn food planning off.",
            m[1].split(" and ").map((w) => { const f = /^feed (\d+) Aniimo$/.exec(w); return f ? T("feed {0} Aniimo", f[1]) : T(w); }).join(T(" and ")))],
          [/^the plan makes no spare (.+)$/, (m) => T("the plan makes no spare {0}", N.itemByName(m[1]))],
          [/^no (.+)$/, (m) => T("no {0}", N.fac(m[1]))],
          [/^(.+) Lv (\d+) needed$/, (m) => T("{0} Lv {1} needed", N.fac(m[1]), m[2])],
          [/^every (.+) is set to another recipe$/, (m) => T("every {0} is set to another recipe", N.fac(m[1]))],
        ];
        for (const [re, f] of rules) { const m = re.exec(s); if (m) return f(m); }
        // a whole sentence with nothing inside it needs no rule, only its dictionary entry (the bench-sharing
        // warning had neither and stayed English; cross-model audit 2026-10-02)
        return T(s);
      },
    };
    return N;
  }

  // Static text of the page: remembered in English once, then shown in the chosen language
  const original = new Map();
  function translatePage(rootEl) {
    const walk = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      if (!original.has(n)) {
        const key = n.nodeValue.replace(/\s+/g, " ").trim();
        if (!key || !(key in PT)) continue;
        original.set(n, { key, lead: /^\s/.test(n.nodeValue) ? " " : "", tail: /\s$/.test(n.nodeValue) ? " " : "" });
      }
    }
    for (const [node, o] of original) node.nodeValue = o.lead + T(o.key) + o.tail;
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
    document.title = T("Aniimo Homeland Planner");
  }

  root.I18N = { T, setLang, lang: () => lang, fmt, names, translatePage, PT };
})(this);
