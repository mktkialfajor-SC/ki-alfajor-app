// --- IMPORTAÇÕES DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO ---
const firebaseConfig = {
    apiKey: "AIzaSyDCax_ecXH7frblalUFKIEtV_iXbe-Iy3E",
  authDomain: "ki-alfajor-app.firebaseapp.com",
  projectId: "ki-alfajor-app",
  storageBucket: "ki-alfajor-app.firebasestorage.app",
  messagingSenderId: "616340676592",
  appId: "1:616340676592:web:6af23611e198fee2af0735"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ESTADO GLOBAL ---
let listaVendas = [];
const fichas = {
    preto: { chocolate: 0.012, doceDeLeite: 0.035, bolacha: 0.008 },
    branco: { chocolate: 0.015, doceDeLeite: 0.035, bolacha: 0.008 }
};

// --- LISTENERS ---
const q = query(collection(db, "vendas"), orderBy("data", "desc"));
onSnapshot(q, (snapshot) => {
    listaVendas = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    preencherFiltroMeses(); // Atualiza o dropdown com meses disponíveis
    atualizarPainelVendas(); // Atualiza a tela
});

onSnapshot(doc(db, "config", "geral"), (docSnap) => {
    if (docSnap.exists()) {
        const d = docSnap.data();
        const set = (id, v) => { if(document.getElementById(id)) document.getElementById(id).value = v; }
        set('pChoc', d.pChoc); set('pDdl', d.pDdl); set('pBol', d.pBol);
        set('pEmb', d.pEmb); set('pMaster', d.pMaster); set('pVenda', d.pVenda);
        set('metaMes', d.metaMes);
        calcular();
        atualizarPainelVendas();
    }
});

// --- FUNÇÃO EXPORTAR EXCEL (NOVO) ---
window.exportarExcel = () => {
    if (listaVendas.length === 0) { alert("Sem dados para exportar."); return; }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Data;Cliente;Tipo;Qtd;Valor Unit;Total\r\n"; // Cabeçalho

    listaVendas.forEach(v => {
        const data = new Date(v.data || v.id).toLocaleDateString('pt-BR');
        const total = v.total.toFixed(2).replace('.', ',');
        const unit = v.precoUnit.toFixed(2).replace('.', ',');
        const row = `${data};${v.cliente};${v.tipo};${v.qtd};${unit};${total}`;
        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "vendas_ki_alfajor.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- FILTRO DE MÊS INTELIGENTE (NOVO) ---
function preencherFiltroMeses() {
    const select = document.getElementById('filtroMesDashboard');
    const valorAtual = select.value;
    
    // Pega meses únicos das vendas
    const mesesUnicos = new Set();
    listaVendas.forEach(v => {
        const d = new Date(v.data || v.id);
        const chave = `${d.getFullYear()}-${d.getMonth()}`; // Ex: 2026-1 (Fev)
        mesesUnicos.add(chave);
    });

    // Adiciona Mês Atual se não existir (para aparecer mesmo sem vendas)
    const hoje = new Date();
    mesesUnicos.add(`${hoje.getFullYear()}-${hoje.getMonth()}`);

    // Reconstrói opções
    select.innerHTML = '<option value="todos">Todo o Período</option>';
    
    // Ordena e cria options
    Array.from(mesesUnicos).sort().reverse().forEach(chave => {
        const [ano, mesIndex] = chave.split('-');
        const nomeMes = new Date(ano, mesIndex).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        // Capitaliza (fevereiro -> Fevereiro)
        const nomeFinal = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
        
        const option = document.createElement('option');
        option.value = chave;
        option.text = nomeFinal;
        select.appendChild(option);
    });

    // Tenta manter seleção anterior ou seleciona o mês atual por padrão
    if (valorAtual && Array.from(select.options).some(o => o.value === valorAtual)) {
        select.value = valorAtual;
    } else {
        // Seleciona o mês atual por padrão
        select.value = `${hoje.getFullYear()}-${hoje.getMonth()}`;
    }
}

// --- RENDERIZAÇÃO COM FILTRO ---
function atualizarPainelVendas() {
    const filtro = document.getElementById('filtroMesDashboard').value;
    
    // 1. Filtrar Vendas
    const vendasFiltradas = listaVendas.filter(v => {
        if (filtro === 'todos') return true;
        const d = new Date(v.data || v.id);
        const chave = `${d.getFullYear()}-${d.getMonth()}`;
        return chave === filtro;
    });

    // 2. Calcular Totais
    let totalFat = 0;
    let vendasCount = 0;
    let fatPorCanal = { 'Final': 0, 'PDV 1': 0, 'PDV 2': 0, 'Distrib.': 0, 'Personalizada': 0 };

    // Ordena do mais recente para o mais antigo
    const vendasOrdenadas = vendasFiltradas.sort((a, b) => (b.data || b.id) - (a.data || a.id));

    vendasOrdenadas.forEach(v => {
        totalFat += v.total;
        vendasCount++;
        let tipo = fatPorCanal[v.tipo] !== undefined ? v.tipo : 'Personalizada';
        fatPorCanal[tipo] += v.total;
    });

    // 3. Atualizar UI
    const meta = parseFloat(document.getElementById('metaMes').value) || 5000;
    document.getElementById('faturamentoTotal').innerText = formatar(totalFat);
    const ticket = vendasCount > 0 ? (totalFat / vendasCount) : 0;
    document.getElementById('ticketMedio').innerText = formatar(ticket);

    const pct = Math.min((totalFat / meta) * 100, 100);
    document.getElementById('barraProgresso').style.width = pct + "%";
    
    const msgMeta = document.getElementById('msgMeta');
    if(msgMeta) {
        msgMeta.innerText = (meta - totalFat) > 0 ? 
            `Faltam ${formatar(meta - totalFat)}` : "META BATIDA! 🎉";
    }

    gerarGraficoDinamico(fatPorCanal, totalFat);
    renderizarHistorico(vendasOrdenadas);
}

function renderizarHistorico(vendas) {
    const container = document.getElementById('containerHistorico');
    if(!container) return;
    container.innerHTML = "";

    if (vendas.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#999; margin-top:20px;'>Nenhuma venda neste período.</p>";
        return;
    }

    const grupos = {};
    vendas.forEach(v => {
        const d = new Date(v.data || v.id);
        const ano = d.getFullYear();
        const mes = d.toLocaleString('pt-BR', { month: 'long' });
        const semana = getNumeroSemana(d);
        const chaveSemana = `Semana ${semana}`;

        if (!grupos[ano]) grupos[ano] = {};
        if (!grupos[ano][mes]) grupos[ano][mes] = {};
        if (!grupos[ano][mes][chaveSemana]) grupos[ano][mes][chaveSemana] = [];
        grupos[ano][mes][chaveSemana].push(v);
    });

    Object.keys(grupos).sort().reverse().forEach(ano => {
        const ordemMeses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
        const mesesDoAno = Object.keys(grupos[ano]).sort((a, b) => ordemMeses.indexOf(a) - ordemMeses.indexOf(b)).reverse();

        mesesDoAno.forEach(mes => {
            const divMes = document.createElement('div');
            divMes.className = 'grupo-mes';
            divMes.innerHTML = `<div class="header-mes">${mes} ${ano}</div>`;

            Object.keys(grupos[ano][mes]).sort().reverse().forEach(semana => {
                const divSemana = document.createElement('div');
                divSemana.className = 'grupo-semana';
                let html = `<span class="header-semana">${semana}</span><table class="mini-tabela">`;
                
                grupos[ano][mes][semana].forEach(v => {
                    html += `<tr>
                        <td width="30%"><strong>${v.cliente}</strong></td>
                        <td width="15%">${v.qtd}cx</td>
                        <td width="25%">${v.tipo}</td>
                        <td width="20%" style="font-weight:bold;">${formatar(v.total)}</td>
                        <td width="10%" style="text-align:right;">
                            <button onclick="prepararEdicao('${v.id}')" class="btn-icon edit"><span class="material-icons">edit</span></button>
                            <button onclick="excluirVenda('${v.id}')" class="btn-icon del"><span class="material-icons">delete</span></button>
                        </td>
                    </tr>`;
                });
                html += `</table>`;
                divSemana.innerHTML = html;
                divMes.appendChild(divSemana);
            });
            container.appendChild(divMes);
        });
    });
}

function gerarGraficoDinamico(dados, total) {
    const container = document.getElementById('containerGraficos');
    if(!container) return;
    container.innerHTML = "";
    if (total === 0) total = 1; 

    const cores = { 'Final': '#e67e22', 'PDV 1': '#3498db', 'PDV 2': '#2980b9', 'Distrib.': '#9b59b6', 'Personalizada': '#27ae60' };

    Object.keys(dados).forEach(canal => {
        const valor = dados[canal];
        if (valor > 0) {
            const pct = (valor / total) * 100;
            const cor = cores[canal] || '#7f8c8d';
            const div = document.createElement('div');
            div.className = 'canal-graph';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:bold; color:#555;">
                    <span>${canal}</span>
                    <span>${formatar(valor)} (${pct.toFixed(0)}%)</span>
                </div>
                <div class="bar-bg"><div class="bar-fill" style="width:${pct}%; background-color:${cor};"></div></div>
            `;
            container.appendChild(div);
        }
    });
}

// --- OUTRAS FUNÇÕES (Mantidas iguais) ---
window.mudarAba = (aba) => {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + aba).style.display = 'block';
    document.getElementById('btn-' + aba).classList.add('active');
};
window.verificarTipoVenda = () => {
    const val = document.getElementById('tipoClienteVenda').value;
    const div = document.getElementById('divValorCustom');
    div.style.display = val === 'custom' ? 'block' : 'none';
};
window.calcular = () => {
    const prod = document.getElementById('filtroProduto') ? document.getElementById('filtroProduto').value : 'preto';
    const f = fichas[prod];
    const getVal = id => parseFloat(document.getElementById(id).value) || 0;
    const pChoc = getVal('pChoc'), pDdl = getVal('pDdl'), pBol = getVal('pBol'), pEmb = getVal('pEmb'), pMaster = getVal('pMaster'), pVenda = getVal('pVenda');

    const custoIngr = (pChoc * f.chocolate) + (pDdl * f.doceDeLeite) + (pBol * f.bolacha);
    const custoUnit = custoIngr + pEmb;
    const custoCaixa = (custoUnit * 16) + pMaster;
    const lucro = pVenda - custoCaixa;
    const margem = pVenda > 0 ? (lucro / pVenda) * 100 : 0;

    document.getElementById('resUnid').innerText = formatar(custoUnit);
    document.getElementById('resLucro').innerText = formatar(lucro);
    document.getElementById('resMargem').innerText = margem.toFixed(1) + "%";
    document.getElementById('resCaixa').innerText = formatar(custoCaixa);
};
window.salvarOuAtualizarVenda = async () => {
    const idEdicao = document.getElementById('idEdicao').value;
    const cliente = document.getElementById('clienteVenda').value;
    const qtd = parseInt(document.getElementById('qtdVendaNova').value);
    const select = document.getElementById('tipoClienteVenda');
    let precoUnit = parseFloat(select.value);
    let tipoNome = select.options[select.selectedIndex].text.split('(')[0].trim();
    if (select.value === 'custom') {
        precoUnit = parseFloat(document.getElementById('valorVendaCustom').value);
        tipoNome = "Personalizada";
    }
    if (!cliente || !qtd) { alert("Preencha tudo!"); return; }
    const dados = { cliente, qtd, tipo: tipoNome, precoUnit, total: qtd * precoUnit, data: Date.now() };
    try {
        if (idEdicao) await updateDoc(doc(db, "vendas", idEdicao), dados);
        else await addDoc(collection(db, "vendas"), dados);
        window.cancelarEdicao();
    } catch (e) { console.error(e); alert("Erro na nuvem."); }
};
window.excluirVenda = async (id) => { if(confirm("Apagar?")) await deleteDoc(doc(db, "vendas", id)); };
window.salvarDados = async () => {
    const dados = {
        pChoc: document.getElementById('pChoc').value, pDdl: document.getElementById('pDdl').value,
        pBol: document.getElementById('pBol').value, pEmb: document.getElementById('pEmb').value,
        pMaster: document.getElementById('pMaster').value, pVenda: document.getElementById('pVenda').value,
        metaMes: document.getElementById('metaMes').value
    };
    await setDoc(doc(db, "config", "geral"), dados);
    alert("Salvo!");
};
window.prepararEdicao = (id) => {
    const venda = listaVendas.find(v => v.id === id);
    if (!venda) return;
    document.getElementById('idEdicao').value = venda.id;
    document.getElementById('clienteVenda').value = venda.cliente;
    document.getElementById('qtdVendaNova').value = venda.qtd;
    const select = document.getElementById('tipoClienteVenda');
    let achou = false;
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value !== 'custom' && Math.abs(parseFloat(select.options[i].value) - venda.precoUnit) < 0.1) {
            select.selectedIndex = i; achou = true; break;
        }
    }
    if (!achou) { select.value = 'custom'; document.getElementById('valorVendaCustom').value = venda.precoUnit; }
    window.verificarTipoVenda();
    document.getElementById('tituloFormulario').innerText = "Editando";
    document.getElementById('tituloFormulario').style.color = "var(--blue)";
    document.getElementById('btnSalvarVenda').innerText = "Atualizar";
    document.getElementById('btnCancelar').style.display = "block";
};
window.cancelarEdicao = () => {
    document.getElementById('idEdicao').value = ""; document.getElementById('clienteVenda').value = "";
    document.getElementById('qtdVendaNova').value = ""; document.getElementById('valorVendaCustom').value = "";
    document.getElementById('tipoClienteVenda').selectedIndex = 0; window.verificarTipoVenda();
    document.getElementById('tituloFormulario').innerText = "Nova Venda";
    document.getElementById('tituloFormulario').style.color = "inherit";
    document.getElementById('btnSalvarVenda').innerText = "Registrar";
    document.getElementById('btnCancelar').style.display = "none";
};
function getNumeroSemana(d) {
    const date = new Date(d.getTime()); date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}
function formatar(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// Inits
document.getElementById('btn-vendas').onclick = () => window.mudarAba('vendas');
document.getElementById('btn-calculadora').onclick = () => window.mudarAba('calculadora');
document.getElementById('btnSalvarGlobal').onclick = window.salvarDados;
document.getElementById('btnSalvarVenda').onclick = window.salvarOuAtualizarVenda;
document.getElementById('btnCancelar').onclick = window.cancelarEdicao;
document.getElementById('filtroProduto').onchange = window.calcular;
document.getElementById('btnExportarExcel').onclick = window.exportarExcel;
document.querySelectorAll('input').forEach(i => i.oninput = window.calcular);
document.getElementById('filtroMesDashboard').onchange = window.atualizarPainelVendas;
document.getElementById('tipoClienteVenda').onchange = window.verificarTipoVenda;

window.mudarAba('vendas');