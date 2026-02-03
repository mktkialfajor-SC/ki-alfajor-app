// --- IMPORTAÇÕES DO FIREBASE (NÃO APAGUE) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc, getDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURAÇÃO (COLE SEUS DADOS AQUI) ---
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

// --- LISTENERS (Escutam mudanças no banco em tempo real) ---

// 1. Escutar Vendas
const q = query(collection(db, "vendas"), orderBy("data", "desc"));
onSnapshot(q, (snapshot) => {
    listaVendas = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    atualizarPainelVendas(); // Atualiza a tela sempre que o banco mudar
});

// 2. Escutar Configurações (Preços e Metas)
onSnapshot(doc(db, "config", "geral"), (docSnap) => {
    if (docSnap.exists()) {
        const d = docSnap.data();
        // Preenche os inputs com os dados da nuvem
        document.getElementById('pChoc').value = d.pChoc || 16.67;
        document.getElementById('pDdl').value = d.pDdl || 22.90;
        document.getElementById('pBol').value = d.pBol || 21.11;
        document.getElementById('pEmb').value = d.pEmb || 0.05;
        document.getElementById('pMaster').value = d.pMaster || 2.85;
        document.getElementById('pVenda').value = d.pVenda || 85.00;
        document.getElementById('metaMes').value = d.metaMes || 5000;
        calcular(); // Recalcula custos
    }
});

// --- FUNÇÕES DE INTERFACE ---

// Navegação
window.mudarAba = (aba) => {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + aba).style.display = 'block';
    document.getElementById('btn-' + aba).classList.add('active');
};

// Calculadora
window.calcular = () => {
    const prod = document.getElementById('filtroProduto') ? document.getElementById('filtroProduto').value : 'preto';
    const f = fichas[prod];
    const pChoc = parseFloat(document.getElementById('pChoc').value) || 0;
    const pDdl = parseFloat(document.getElementById('pDdl').value) || 0;
    const pBol = parseFloat(document.getElementById('pBol').value) || 0;
    const pEmb = parseFloat(document.getElementById('pEmb').value) || 0;
    const pMaster = parseFloat(document.getElementById('pMaster').value) || 0;
    const pVenda = parseFloat(document.getElementById('pVenda').value) || 0;

    const custoIngr = (pChoc * f.chocolate) + (pDdl * f.doceDeLeite) + (pBol * f.bolacha) + pEmb;
    const custoCaixa = ((custoIngr + pEmb) * 16) + pMaster;
    const lucro = pVenda - custoCaixa;
    const margem = pVenda > 0 ? (lucro / pVenda) * 100 : 0;

    document.getElementById('resUnid').innerText = formatar(custoIngr);
    document.getElementById('resLucro').innerText = formatar(lucro);
    document.getElementById('resMargem').innerText = margem.toFixed(1) + "%";
};

// --- CRUD FIREBASE ---

window.verificarTipoVenda = () => {
    const val = document.getElementById('tipoClienteVenda').value;
    const div = document.getElementById('divValorCustom');
    div.style.display = val === 'custom' ? 'block' : 'none';
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

    const dadosVenda = {
        cliente, qtd, tipo: tipoNome, precoUnit, 
        total: qtd * precoUnit,
        data: Date.now() // Timestamp para ordenar
    };

    try {
        if (idEdicao) {
            // EDITAR NA NUVEM
            await updateDoc(doc(db, "vendas", idEdicao), dadosVenda);
            alert("Venda atualizada!");
        } else {
            // CRIAR NA NUVEM
            await addDoc(collection(db, "vendas"), dadosVenda);
        }
        window.cancelarEdicao();
    } catch (e) {
        console.error("Erro ao salvar: ", e);
        alert("Erro ao salvar na nuvem.");
    }
};

window.excluirVenda = async (id) => {
    if(confirm("Apagar permanentemente?")) {
        await deleteDoc(doc(db, "vendas", id));
    }
};

window.prepararEdicao = (id) => {
    const venda = listaVendas.find(v => v.id === id);
    if (!venda) return;
    document.getElementById('idEdicao').value = venda.id;
    document.getElementById('clienteVenda').value = venda.cliente;
    document.getElementById('qtdVendaNova').value = venda.qtd;
    // Lógica para setar o select (simplificada)
    document.getElementById('btnSalvarVenda').innerText = "Atualizar";
    document.getElementById('btnCancelar').style.display = "block";
};

window.cancelarEdicao = () => {
    document.getElementById('idEdicao').value = "";
    document.getElementById('clienteVenda').value = "";
    document.getElementById('qtdVendaNova').value = "";
    document.getElementById('btnSalvarVenda').innerText = "Registrar";
    document.getElementById('btnCancelar').style.display = "none";
};

window.salvarDados = async () => {
    // Salva configurações gerais (preços e metas) no documento 'config/geral'
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
    alert("Configurações salvas na nuvem para todos!");
};

// --- RENDERIZAÇÃO ---
function atualizarPainelVendas() {
    // (Mesma lógica de agrupamento e HTML da versão anterior, 
    // mas agora usando 'listaVendas' que vem do Firebase)
    const container = document.getElementById('containerHistorico');
    container.innerHTML = "";
    let totalFat = 0;
    
    // ... [Copie a lógica de renderização HTML da V15 aqui] ...
    // Para economizar espaço na resposta, a lógica de renderização é idêntica,
    // apenas lembre-se que listaVendas agora é atualizada automaticamente pelo onSnapshot.
    
    // Vou colocar a versão encurtada do render:
    listaVendas.forEach(v => totalFat += v.total);
    document.getElementById('faturamentoTotal').innerText = formatar(totalFat);
    // ... Atualizar barra de progresso etc ...
    
    // Renderiza lista simples (pode substituir pelo agrupado se quiser)
    if (listaVendas.length === 0) container.innerHTML = "Sem vendas.";
    
    listaVendas.forEach(v => {
        const div = document.createElement('div');
        div.className = 'grupo-semana'; // Reutilizando estilo
        div.innerHTML = `<strong>${v.cliente}</strong> - ${v.tipo} - ${formatar(v.total)} 
            <button onclick="excluirVenda('${v.id}')">🗑️</button>`;
        container.appendChild(div);
    });
}

function formatar(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// Event Listeners manuais (já que é module)
document.getElementById('btn-vendas').onclick = () => window.mudarAba('vendas');
document.getElementById('btn-calculadora').onclick = () => window.mudarAba('calculadora');
document.getElementById('btnSalvarGlobal').onclick = window.salvarDados;
document.getElementById('btnSalvarVenda').onclick = window.salvarOuAtualizarVenda;
document.getElementById('btnCancelar').onclick = window.cancelarEdicao;
document.getElementById('filtroProduto').onchange = window.calcular;
document.querySelectorAll('input').forEach(i => i.oninput = window.calcular);
document.getElementById('tipoClienteVenda').onchange = window.verificarTipoVenda;