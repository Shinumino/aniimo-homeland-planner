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
    "I have Moonray Wheat to buy event seeds (Moondew Radish, Waxing Moon Pepper)":
      "Tenho Trigo do Luar para comprar sementes de evento (Rabanete Orvalho-lunar, Pimenta da Lua Crescente)",
    "Next RV level": "Próximo nível do Motorhome",
    "Upgrade to RV": "Melhorar para o Motorhome",
    "Plan for the fastest upgrade (instead of the most coin)": "Planejar a melhoria mais rápida (em vez da maior renda)",
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
    "Suggested roster": "Equipe sugerida",
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
    "{0}: {1} Aniimo.": "{0}: {1} Aniimo.",
    "Click a column to sort.": "Clique numa coluna para ordenar.",
    "Jobs it can do": "Trabalhos que faz",
    "Works on": "Trabalha em",
    "No Aniimo can do: {0}": "Nenhum Aniimo consegue fazer: {0}",
    "No best-case plan: {0}": "Sem plano de melhor caso: {0}",
    "{0} Home Coin / hour with the best Aniimo": "{0} Moedas do Lar / hora com os melhores Aniimo",
    "({0} / day)": "({0} / dia)",
    "{0} / hour vs your current plan": "{0} / hora contra seu plano atual",
    "Same facilities, RV and options; every job gets the highest ability level that exists {0}, with a matching personality.":
      "Mesmas instalações, Motorhome e opções; cada trabalho recebe o maior nível de habilidade que existe {0}, com a personalidade certa.",
    "(Prismana forms included)": "(com formas Prismana)",
    "(without Prismana forms)": "(sem formas Prismana)",
    "level {0}": "nível {0}",
    "Best-case roster": "Equipe do melhor caso",
    "Game data build {0} · runs entirely on this PC": "Dados do jogo, build {0} · roda inteiro neste PC",
    "{0} family": "família {0}",
    "(watering)": "(regar)",
    "Warm +1": "Morno +1", "Scorching +2": "Escaldante +2", "Cool -1": "Fresco -1", "Cold -2": "Frio -2", "Light": "Luz",
    "Quick": "Rápida", "Premium": "Premium", "High-Speed": "Alta velocidade",
    // Next RV panel
    "RV 20 is the last level.": "O Motorhome 20 é o último nível.",
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
    "No plan found within {0} s. Try fewer options or a smaller layout.": "Nenhum plano encontrado em {0} s. Tente menos opções ou um layout menor.",
    "best found in {0} s": "melhor encontrado em {0} s",
    "No Aniimo left for production: cap - reserved - haulers is {0}.": "Nenhum Aniimo sobra para a produção: limite - fora da produção - carregadores dá {0}.",
    "{0} level {1} needs RV {2}.": "{0} nível {1} precisa do Motorhome {2}.",
    "RV {0} allows {1} {2}, not {3}: planning with {4}.": "O Motorhome {0} permite {1} {2}, não {3}: planejando com {4}.",
    "Nothing in your layout can make {0}.": "Nada no seu layout consegue fazer {0}.",
    "This layout cannot {0} with the Aniimo available. Lower a target, add facilities, or turn food planning off.":
      "Este layout não consegue {0} com os Aniimo disponíveis. Baixe uma meta, adicione instalações ou desligue o planejamento de comida.",
    "feed {0} Aniimo": "alimentar {0} Aniimo",
    "make what you asked to keep": "fazer o que você pediu para guardar",
    "work": "funcionar",
    " and ": " e ",
    "This layout cannot make the RV {0} materials: see Next RV level.": "Este layout não consegue fazer os materiais do Motorhome {0}: veja Próximo nível do Motorhome.",
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

  // Game names. Every lookup takes the English key the planner uses and falls back to it.
  function names(D) {
    const pt = () => (lang === "pt" && D.i18n && D.i18n.pt) || null;
    const byName = {};
    for (const [id, it] of Object.entries(D.items)) byName[it.n] = id;
    const firstOf = {};
    for (const a of D.aniimo || []) if (!(a.n in firstOf)) firstOf[a.n] = a.id;
    const N = {
      item: (id) => { const p = pt(); return (p && p.items[id]) || (D.items[id] ? D.items[id].n : String(id)); },
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
          [/^No plan found within (\d+) s\./, (m) => T("No plan found within {0} s. Try fewer options or a smaller layout.", m[1])],
          [/^No Aniimo left for production: cap - reserved - haulers is (.+)\.$/, (m) => T("No Aniimo left for production: cap - reserved - haulers is {0}.", m[1])],
          [/^(.+) level (\d+) needs (.+) level \d+: planning with level (\d+)\.$/, (m) => T("{0} level {1} needs {2} level {1}: planning with level {3}.", N.fac(m[1]), m[2], (pt() && pt().modules[m[3]]) || m[3], m[4])],
          [/^(.+) level (\d+) needs RV (\d+)\.$/, (m) => T("{0} level {1} needs RV {2}.", N.fac(m[1]), m[2], m[3])],
          [/^RV (\d+) allows (\d+) (.+), not (\d+): planning with (\d+)\.$/, (m) => T("RV {0} allows {1} {2}, not {3}: planning with {4}.", m[1], m[2], N.fac(m[3]), m[4], m[5])],
          [/^Nothing in your layout can make (.+)\.$/, (m) => T("Nothing in your layout can make {0}.", N.itemByName(m[1]))],
          [/^This layout cannot make the RV (\d+) materials: see Next RV level\.$/, (m) => T("This layout cannot make the RV {0} materials: see Next RV level.", m[1])],
          [/^This layout cannot (.+) with the Aniimo available\./, (m) => T("This layout cannot {0} with the Aniimo available. Lower a target, add facilities, or turn food planning off.",
            m[1].split(" and ").map((w) => { const f = /^feed (\d+) Aniimo$/.exec(w); return f ? T("feed {0} Aniimo", f[1]) : T(w); }).join(T(" and ")))],
          [/^the plan makes no spare (.+)$/, (m) => T("the plan makes no spare {0}", N.itemByName(m[1]))],
          [/^no (.+)$/, (m) => T("no {0}", N.fac(m[1]))],
          [/^(.+) Lv (\d+) needed$/, (m) => T("{0} Lv {1} needed", N.fac(m[1]), m[2])],
          [/^every (.+) is set to another recipe$/, (m) => T("every {0} is set to another recipe", N.fac(m[1]))],
        ];
        for (const [re, f] of rules) { const m = re.exec(s); if (m) return f(m); }
        return s;
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

  root.I18N = { T, setLang, lang: () => lang, names, translatePage, PT };
})(this);
