// --- IMPORTAÇÕES DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO (COLE SUA API KEY AQUI) ---
const firebaseConfig = {
    apiKey: "AIzaSyDCax_ecXH7frblalUFKIEtV_iXbe-Iy3E",
  authDomain: "ki-alfajor-app.firebaseapp.com",
  projectId: "ki-alfajor-app",
  storageBucket: "ki-alfajor-app.firebasestorage.app",
  messagingSenderId: "616340676592",
  appId: "1:616340676592:web:6af23611e198fee2af0735"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ESTADO GLOBAL ---
let listaVendas = [];

const fichas = {
    preto: { chocolate: 0.012, doceDeLeite: 0.035, bolacha: 0.008 },
    branco: { chocolate: 0.015, doceDeLeite: 0.035, bolacha: 0.008 }
};

// --- LISTENERS (Tempo Real) ---

// 1. Escutar Vendas
const q = query(collection(db, "vendas"), orderBy("data", "desc"));
onSnapshot(q, (snapshot) => {
    listaVendas = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    atualizarPainelVendas(); // Atualiza tudo
});

// 2. Escutar Configurações
onSnapshot(doc(db, "config", "geral"), (docSnap) => {
    if (docSnap.exists()) {
        const d = docSnap.data();
        // Atualiza inputs se vierem da nuvem
        const setVal = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val; };
        
        setVal('pChoc', d.pChoc || 16.67);
        setVal('pDdl', d.pDdl || 22.90);
        setVal('pBol', d.pBol || 21.11);
        setVal('pEmb', d.pEmb || 0.05);
        setVal('pMaster', d.pMaster || 2.85);
        setVal('pVenda', d.pVenda || 85.00);
        setVal('metaMes', d.metaMes || 5000);
        
        calcular();
        atualizarPainelVendas();
    }
});

// --- FUNÇÕES DE NAVEGAÇÃO ---
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

// --- CALCULADORA (LÓGICA CORRIGIDA) ---
window.calcular = () => {
    const prod = document.getElementById('filtroProduto') ? document.getElementById('filtroProduto').value : 'preto';
    const f = fichas[prod];

    const pChoc = parseFloat(document.getElementById('pChoc').value) || 0;
    const pDdl = parseFloat(document.getElementById('pDdl').value) || 0;
    const pBol = parseFloat(document.getElementById('pBol').value) || 0;
    const pEmb = parseFloat(document.getElementById('pEmb').value) || 0;
    const pMaster = parseFloat(document.getElementById('pMaster').value) || 0;
    const pVenda = parseFloat(document.getElementById('pVenda').value) || 0;

    // 1. Ingredientes puros
    const custoIngredientes = (pChoc * f.chocolate) + (pDdl * f.doceDeLeite) + (pBol * f.bolacha);
    
    // 2. Custo Unitário (Ingredientes + 1 Embalagem)
    const custoUnitarioFinal = custoIngredientes + pEmb;

    // 3. Custo Caixa (16 Unidades + 1 Caixa Master)
    // CORREÇÃO: Multiplica o unitário por 16 e soma a master só no final
    const custoCaixa = (custoUnitarioFinal * 16) + pMaster;

    const lucro = pVenda - custoCaixa;
    const margem = pVenda > 0 ? (lucro / pVenda) * 100 : 0;

    document.getElementById('resUnid').innerText = formatar(custoUnitarioFinal);
    document.getElementById('resLucro').innerText = formatar(lucro);
    document.getElementById('resMargem').innerText = margem.toFixed(1) + "%";
    document.getElementById('resCaixa').innerText = formatar(custoCaixa);
};

// --- CRUD FIREBASE ---
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

    if (!cliente || !qtd) { alert("Preencha todos os campos!"); return; }

    const dadosVenda = {
        cliente, qtd, tipo: tipoNome, precoUnit, 
        total: qtd * precoUnit,
        data: Date.now()
    };

    try {
        if (idEdicao) {
            await updateDoc(doc(db, "vendas", idEdicao), dadosVenda);
            alert("Atualizado!");
        } else {
            await addDoc(collection(db, "vendas"), dadosVenda);
        }
        window.cancelarEdicao();
    } catch (e) {
        console.error(e);
        alert("Erro na nuvem.");
    }
};

window.excluirVenda = async (id) => {
    if(confirm("Apagar venda?")) {
        await deleteDoc(doc(db, "vendas", id));
    }
};

window.salvarDados = async () => {
    const dados = {
        pChoc: document.getElementById('pChoc').value,
        pDdl: document.getElementById('pDdl').value,
        pBol: document.getElementById('pBol').value,
        pEmb: document.getElementById('pEmb').value,
        pMaster: document.getElementById('pMaster').value,
        pVenda: document.getElementById('pVenda').value,
        metaMes: document.getElementById('metaMes').value
    };
    await setDoc(doc(db, "config", "geral"), dados);
    alert("Sincronizado com sucesso!");
};

// --- FUNÇÕES DE EDIÇÃO ---
window.prepararEdicao = (id) => {
    const venda = listaVendas.find(v => v.id === id);
    if (!venda) return;
    
    document.getElementById('idEdicao').value = venda.id;
    document.getElementById('clienteVenda').value = venda.cliente;
    document.getElementById('qtdVendaNova').value = venda.qtd;
    
    const select = document.getElementById('tipoClienteVenda');
    let achou = false;
    for (let i = 0; i < select.options.length; i++) {
        // Verifica se valor bate (ignorando pequenas diferenças decimais)
        if (select.options[i].value !== 'custom' && Math.abs(parseFloat(select.options[i].value) - venda.precoUnit) < 0.1) {
            select.selectedIndex = i;
            achou = true;
            break;
        }
    }
    
    if (!achou) {
        select.value = 'custom';
        document.getElementById('valorVendaCustom').value = venda.precoUnit;
    }
    window.verificarTipoVenda();

    document.getElementById('tituloFormulario').innerText = "Editando Venda";
    document.getElementById('tituloFormulario').style.color = "var(--blue)";
    document.getElementById('btnSalvarVenda').innerText = "Atualizar";
    document.getElementById('btnCancelar').style.display = "block";
};

window.cancelarEdicao = () => {
    document.getElementById('idEdicao').value = "";
    document.getElementById('clienteVenda').value = "";
    document.getElementById('qtdVendaNova').value = "";
    document.getElementById('valorVendaCustom').value = "";
    document.getElementById('tipoClienteVenda').selectedIndex = 0;
    window.verificarTipoVenda();
    
    document.getElementById('tituloFormulario').innerText = "Nova Venda";
    document.getElementById('tituloFormulario').style.color = "inherit";
    document.getElementById('btnSalvarVenda').innerText = "Registrar";
    document.getElementById('btnCancelar').style.display = "none";
};

// --- RENDERIZAÇÃO VISUAL ---
function atualizarPainelVendas() {
    const container = document.getElementById('containerHistorico');
    if(container) container.innerHTML = "";
    
    let totalFat = 0;
    let vendasCount = 0;
    let fatPorCanal = { 'Final': 0, 'PDV 1': 0, 'PDV 2': 0, 'Distrib.': 0, 'Personalizada': 0 };

    const vendasOrdenadas = listaVendas.slice().sort((a, b) => b.data - a.data);

    vendasOrdenadas.forEach(v => {
        totalFat += v.total;
        vendasCount++;
        // Agrupa para o gráfico (se o nome não existir no objeto, joga em Personalizada)
        let tipoGrafico = fatPorCanal[v.tipo] !== undefined ? v.tipo : 'Personalizada';
        fatPorCanal[tipoGrafico] += v.total;
    });

    // Topo
    const metaDinheiro = parseFloat(document.getElementById('metaMes').value) || 5000;
    document.getElementById('faturamentoTotal').innerText = formatar(totalFat);
    const ticket = vendasCount > 0 ? (totalFat / vendasCount) : 0;
    document.getElementById('ticketMedio').innerText = formatar(ticket);

    // Barra Progresso
    const pct = Math.min((totalFat / metaDinheiro) * 100, 100);
    document.getElementById('barraProgresso').style.width = pct + "%";
    const msgMeta = document.getElementById('msgMeta');
    if(msgMeta) msgMeta.innerText = (metaDinheiro - totalFat) > 0 ? 
        `Faltam ${formatar(metaDinheiro - totalFat)}` : "META BATIDA! 🎉";

    // DESENHAR GRÁFICO
    gerarGraficoDinamico(fatPorCanal, totalFat);

    // HISTÓRICO AGRUPADO
    if (vendasOrdenadas.length === 0 && container) {
        container.innerHTML = "<p style='text-align:center; color:#999; margin-top:20px;'>Nenhuma venda registrada.</p>";
        return;
    }

    const grupos = {};
    vendasOrdenadas.forEach(v => {
        const timestamp = v.data || parseInt(v.id); 
        const dataObj = new Date(timestamp);
        const ano = dataObj.getFullYear();
        const mes = dataObj.toLocaleString('pt-BR', { month: 'long' });
        const semana = getNumeroSemana(dataObj);
        const chaveSemana = `Semana ${semana}`;

        if (!grupos[ano]) grupos[ano] = {};
        if (!grupos[ano][mes]) grupos[ano][mes] = {};
        if (!grupos[ano][mes][chaveSemana]) grupos[ano][mes][chaveSemana] = [];
        grupos[ano][mes][chaveSemana].push(v);
    });

    if(container) {
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
                    let htmlSemana = `<span class="header-semana">${semana}</span><table class="mini-tabela">`;
                    
                    grupos[ano][mes][semana].forEach(v => {
                        htmlSemana += `
                            <tr>
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
                    htmlSemana += `</table>`;
                    divSemana.innerHTML = htmlSemana;
                    divMes.appendChild(divSemana);
                });
                container.appendChild(divMes);
            });
        });
    }
}

function gerarGraficoDinamico(dados, total) {
    const container = document.getElementById('containerGraficos');
    if(!container) return;
    container.innerHTML = "";
    if (total === 0) total = 1; 

    // Cores
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

function getNumeroSemana(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function formatar(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// Associações
document.getElementById('btn-vendas').onclick = () => window.mudarAba('vendas');
document.getElementById('btn-calculadora').onclick = () => window.mudarAba('calculadora');
document.getElementById('btnSalvarGlobal').onclick = window.salvarDados;
document.getElementById('btnSalvarVenda').onclick = window.salvarOuAtualizarVenda;
document.getElementById('btnCancelar').onclick = window.cancelarEdicao;
document.getElementById('filtroProduto').onchange = window.calcular;
document.querySelectorAll('input').forEach(i => i.oninput = window.calcular);
document.getElementById('tipoClienteVenda').onchange = window.verificarTipoVenda;

window.mudarAba('vendas');