/* ===========================
   Keerana / Kirana Billing App
   Pure JS • Offline • LocalStorage
   =========================== */

(function () {
  // ---------- Utilities ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const fmt = (n) => `₹${Number(n || 0).toFixed(2)}`;
  const uid = (prefix = "BILL") =>
    `${prefix}-${new Date().toISOString().replaceAll(/[-:.TZ]/g, "").slice(0,14)}-${Math.floor(Math.random()*1000)}`;

  const storage = {
    get(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  };

  const state = {
    items: [],
    saved: storage.get("kbills", []),
    theme: storage.get("ktheme", "dark")
  };

  // ---------- Sample Inventory (edit as you like) ----------
  const INVENTORY = [
    { name:"Rice Sona Masoori", unit:"kg", rate:64, gst:0, disc:0 },
    { name:"Wheat Flour", unit:"kg", rate:52, gst:0, disc:0 },
    { name:"Toor Dal", unit:"kg", rate:135, gst:0, disc:0 },
    { name:"Sugar", unit:"kg", rate:46, gst:0, disc:0 },
    { name:"Salt (1 kg)", unit:"pcs", rate:22, gst:0, disc:0 },
    { name:"Sunflower Oil 1L", unit:"L", rate:135, gst:5, disc:0 },
    { name:"Groundnut Oil 1L", unit:"L", rate:150, gst:5, disc:0 },
    { name:"Tea Powder 250g", unit:"g", rate:95, gst:5, disc:0 },
    { name:"Coffee 200g", unit:"g", rate:185, gst:5, disc:0 },
    { name:"Detergent (1 kg)", unit:"pcs", rate:110, gst:18, disc:0 },
    { name:"Bath Soap", unit:"pcs", rate:35, gst:18, disc:0 },
    { name:"Shampoo Sachets (10)", unit:"pcs", rate:40, gst:18, disc:0 },
    { name:"Biscuits (Pack)", unit:"pcs", rate:30, gst:18, disc:0 },
    { name:"Bread", unit:"pcs", rate:35, gst:0, disc:0 },
    { name:"Eggs (12)", unit:"pcs", rate:78, gst:0, disc:0 },
  ];

  // ---------- DOM ----------
  const billNo = $("#billNo");
  const billDate = $("#billDate");
  const cashier = $("#cashier");
  const customerName = $("#customerName");
  const customerPhone = $("#customerPhone");

  const itemName = $("#itemName");
  const itemQty = $("#itemQty");
  const itemUnit = $("#itemUnit");
  const itemRate = $("#itemRate");
  const itemGst = $("#itemGst");
  const itemDisc = $("#itemDisc");

  const addItemBtn = $("#addItemBtn");
  const quickItemBtn = $("#quickItemBtn");

  const itemsTableBody = $("#itemsTable tbody");
  const subTotalCell = $("#subTotalCell");
  const gstTotalCell = $("#gstTotalCell");
  const grandTotalCell = $("#grandTotalCell");
  const overallDiscount = $("#overallDiscount");
  const overallDiscountDisplay = $("#overallDiscountDisplay");

  const paidAmount = $("#paidAmount");
  const paymentMode = $("#paymentMode");
  const changeDue = $("#changeDue");

  const searchRows = $("#searchRows");

  const newBillBtn = $("#newBillBtn");
  const saveBillBtn = $("#saveBillBtn");
  const exportCsvBtn = $("#exportCsvBtn");
  const printBtn = $("#printBtn");
  const toggleTheme = $("#toggleTheme");

  const savedBillsTable = $("#savedBillsTable tbody");
  const savedSearch = $("#savedSearch");
  const clearSaved = $("#clearSaved");

  const list = $("#inventoryList");
  INVENTORY.forEach(i => {
    const o = document.createElement("option");
    o.value = i.name;
    list.appendChild(o);
  });

  // Theme
  const applyTheme = () => {
    if (state.theme === "light") document.documentElement.classList.add("light");
    else document.documentElement.classList.remove("light");
    storage.set("ktheme", state.theme);
  };
  toggleTheme.addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme();
  });
  applyTheme();

  // ---------- Bill lifecycle ----------
  function resetBill(newId = true) {
    state.items = [];
    itemsTableBody.innerHTML = "";
    if (newId) billNo.value = uid("BILL");
    billDate.value = new Date().toLocaleString();
    customerName.value = "";
    customerPhone.value = "";
    overallDiscount.value = 0;
    paidAmount.value = 0;
    changeDue.value = fmt(0);
    updateTotals();
    itemName.focus();
  }

  function addItem(row) {
    state.items.push(row);
    renderRows();
    updateTotals();
  }

  function renderRows() {
    itemsTableBody.innerHTML = "";
    state.items.forEach((row, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td contenteditable="true" data-field="name">${row.name}</td>
        <td class="right" contenteditable="true" data-field="qty">${row.qty}</td>
        <td contenteditable="true" data-field="unit">${row.unit}</td>
        <td class="right" contenteditable="true" data-field="rate">${row.rate}</td>
        <td class="right" contenteditable="true" data-field="gst">${row.gst}</td>
        <td class="right" contenteditable="true" data-field="disc">${row.disc}</td>
        <td class="right">${fmt(row.amount)}</td>
        <td class="right">
          <button class="btn ghost" data-act="dup" title="Duplicate">⎘</button>
          <button class="btn ghost" data-act="del" title="Remove">✕</button>
        </td>
      `;
      // Inline edit handler
      tr.addEventListener("input", (e) => {
        const cell = e.target.closest("[data-field]");
        if (!cell) return;
        const field = cell.dataset.field;
        let val = cell.innerText.trim();
        if (["qty","rate","gst","disc"].includes(field)) val = Number(val) || 0;
        state.items[idx][field] = field === "name" || field === "unit" ? val : Number(val);
        recalcRow(idx);
        updateRowAmount(tr, state.items[idx].amount);
        updateTotals();
      });
      tr.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        if (btn.dataset.act === "del") {
          state.items.splice(idx,1);
          renderRows(); updateTotals();
        } else if (btn.dataset.act === "dup") {
          state.items.splice(idx+1,0, structuredClone(state.items[idx]));
          renderRows(); updateTotals();
        }
      });
      itemsTableBody.appendChild(tr);
    });
  }

  function updateRowAmount(tr, amt) {
    tr.children[7].textContent = fmt(amt);
  }

  function recalcRow(idx) {
    const r = state.items[idx];
    const base = r.qty * r.rate;
    const gstAmt = base * (r.gst/100);
    const discAmt = base * (r.disc/100);
    r.amount = Math.max(0, base + gstAmt - discAmt);
  }

  function updateTotals() {
    state.items.forEach((_, i) => recalcRow(i));
    const subTotal = state.items.reduce((a,r)=> a + (r.qty*r.rate), 0);
    const gstTotal = state.items.reduce((a,r)=> a + (r.qty*r.rate)*(r.gst/100), 0);
    const itemDiscounts = state.items.reduce((a,r)=> a + (r.qty*r.rate)*(r.disc/100), 0);
    const overDisc = Number(overallDiscount.value) || 0;
    const grand = Math.max(0, subTotal + gstTotal - itemDiscounts - overDisc);

    subTotalCell.textContent = fmt(subTotal);
    gstTotalCell.textContent = fmt(gstTotal);
    overallDiscountDisplay.textContent = fmt(overDisc);
    grandTotalCell.textContent = fmt(grand);

    const paid = Number(paidAmount.value)||0;
    changeDue.value = fmt(Math.max(0, paid - grand));
  }

  // ---------- Add Item flow ----------
  function fillFromInventory(name) {
    const found = INVENTORY.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (found) {
      itemUnit.value = found.unit;
      itemRate.value = found.rate;
      itemGst.value = found.gst;
      itemDisc.value = found.disc;
    }
  }

  itemName.addEventListener("change", () => fillFromInventory(itemName.value));

  function addItemFromForm() {
    const row = {
      name: (itemName.value || "").trim() || "Custom Item",
      qty: Math.max(1, Number(itemQty.value) || 1),
      unit: itemUnit.value || "pcs",
      rate: Math.max(0, Number(itemRate.value) || 0),
      gst: Math.max(0, Number(itemGst.value) || 0),
      disc: Math.max(0, Number(itemDisc.value) || 0),
      amount: 0
    };
    row.amount = (row.qty*row.rate) * (1 + row.gst/100) - (row.qty*row.rate)*(row.disc/100);
    addItem(row);
    // reset quick fields
    itemName.value = "";
    itemQty.value = 1;
    itemRate.value = "";
    itemGst.value = 0;
    itemDisc.value = 0;
    itemName.focus();
  }

  addItemBtn.addEventListener("click", addItemFromForm);
  itemName.addEventListener("keydown", (e)=>{ if (e.key==="Enter") addItemFromForm(); });
  itemDisc.addEventListener("keydown", (e)=>{ if (e.key==="Enter") addItemFromForm(); });

  // Quick Item
  quickItemBtn.addEventListener("click", ()=>{
    const name = prompt("Item name?");
    if (!name) return;
    const qty = Number(prompt("Qty?", "1"))||1;
    const unit = prompt("Unit (pcs/kg/L/ml/g)?", "pcs")||"pcs";
    const rate = Number(prompt("Rate ₹?", "0"))||0;
    const gst = Number(prompt("GST %?", "0"))||0;
    const disc = Number(prompt("Disc %?", "0"))||0;
    addItem({name, qty, unit, rate, gst, disc, amount: 0});
    updateTotals();
  });

  // Row filtering
  searchRows.addEventListener("input", () => {
    const q = searchRows.value.toLowerCase();
    $$("#itemsTable tbody tr").forEach(tr => {
      const text = tr.children[1].innerText.toLowerCase();
      tr.style.display = text.includes(q) ? "" : "none";
    });
  });

  // Totals reactive
  overallDiscount.addEventListener("input", updateTotals);
  paidAmount.addEventListener("input", updateTotals);

  // ---------- Save / Load Bills ----------
  function billPayload() {
    const subTotal = state.items.reduce((a,r)=> a + (r.qty*r.rate), 0);
    const gstTotal = state.items.reduce((a,r)=> a + (r.qty*r.rate)*(r.gst/100), 0);
    const itemDiscounts = state.items.reduce((a,r)=> a + (r.qty*r.rate)*(r.disc/100), 0);
    const overDisc = Number(overallDiscount.value)||0;
    const grand = Math.max(0, subTotal + gstTotal - itemDiscounts - overDisc);

    return {
      billNo: billNo.value,
      billDate: billDate.value,
      cashier: cashier.value,
      customerName: customerName.value,
      customerPhone: customerPhone.value,
      paymentMode: paymentMode.value,
      items: structuredClone(state.items),
      totals: {
        subTotal, gstTotal, itemDiscounts, overallDiscount: overDisc, grand,
        paid: Number(paidAmount.value)||0,
        change: Math.max(0, (Number(paidAmount.value)||0) - grand)
      }
    };
  }

  function saveBill() {
    const payload = billPayload();
    if (!payload.items.length) { alert("Add at least one item."); return; }
    // upsert by billNo
    const idx = state.saved.findIndex(b => b.billNo === payload.billNo);
    if (idx >= 0) state.saved[idx] = payload; else state.saved.unshift(payload);
    storage.set("kbills", state.saved);
    renderSaved();
    alert("Bill saved.");
  }

  function renderSaved() {
    const q = (savedSearch.value||"").toLowerCase();
    savedBillsTable.innerHTML = "";
    state.saved
      .filter(b =>
        b.billNo.toLowerCase().includes(q) ||
        (b.customerName||"").toLowerCase().includes(q) ||
        (b.customerPhone||"").toLowerCase().includes(q)
      )
      .forEach(b => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${b.billNo}</td>
          <td>${b.customerName||"-"}</td>
          <td>${b.customerPhone||"-"}</td>
          <td>${b.billDate}</td>
          <td class="right">${fmt(b.totals.grand)}</td>
          <td>${b.paymentMode}</td>
          <td class="right">
            <button class="btn ghost" data-act="load">Load</button>
            <button class="btn ghost danger" data-act="delete">Delete</button>
          </td>
        `;
        tr.addEventListener("click", (e)=>{
          const btn = e.target.closest("button");
          if (!btn) return;
          if (btn.dataset.act === "load") loadBill(b.billNo);
          if (btn.dataset.act === "delete") {
            if (confirm("Delete saved bill permanently?")) {
              state.saved = state.saved.filter(x => x.billNo !== b.billNo);
              storage.set("kbills", state.saved);
              renderSaved();
            }
          }
        });
        savedBillsTable.appendChild(tr);
      });
  }

  function loadBill(id) {
    const b = state.saved.find(x => x.billNo === id);
    if (!b) return alert("Not found.");
    billNo.value = b.billNo;
    billDate.value = b.billDate;
    cashier.value = b.cashier;
    customerName.value = b.customerName;
    customerPhone.value = b.customerPhone;
    paymentMode.value = b.paymentMode;
    overallDiscount.value = b.totals.overallDiscount || 0;
    paidAmount.value = b.totals.paid || 0;
    state.items = structuredClone(b.items);
    renderRows();
    updateTotals();
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  savedSearch.addEventListener("input", renderSaved);
  clearSaved.addEventListener("click", ()=>{
    if (!state.saved.length) return;
    if (confirm("Clear ALL saved bills? This cannot be undone.")) {
      state.saved = [];
      storage.set("kbills", state.saved);
      renderSaved();
    }
  });

  // ---------- CSV Export ----------
  function exportCSV() {
    const b = billPayload();
    const head = ["#","Item","Qty","Unit","Rate","GST%","Disc%","Amount"];
    const rows = b.items.map((r,i)=>[i+1,r.name,r.qty,r.unit,r.rate,r.gst,r.disc,(r.amount).toFixed(2)]);
    const totals = [
      [],["SubTotal","","","","","","", b.totals.subTotal.toFixed(2)],
      ["GST Total","","","","","","", b.totals.gstTotal.toFixed(2)],
      ["Overall Discount","","","","","","", b.totals.overallDiscount.toFixed(2)],
      ["Grand Total","","","","","","", b.totals.grand.toFixed(2)],
      ["Paid","","","","","","", (b.totals.paid).toFixed(2)],
      ["Change","","","","","","", (b.totals.change).toFixed(2)]
    ];
    const meta = [
      ["Bill No", b.billNo],["Date", b.billDate],["Cashier", b.cashier],
      ["Customer", b.customerName],["Phone", b.customerPhone],["Payment", b.paymentMode],[]
    ];
    const csv = [
      ...meta.map(r=>r.join(",")),
      head.join(","),
      ...rows.map(r=>r.join(",")),
      ...totals.map(r=>r.join(","))
    ].join("\n");

    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${b.billNo}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Print ----------
  function printInvoice() {
    const b = billPayload();
    const tpl = $("#printTemplate").content.cloneNode(true);
    const map = {
      billNo: b.billNo, billDate: b.billDate, cashier: b.cashier,
      customerName: b.customerName, customerPhone: b.customerPhone,
      paymentMode: b.paymentMode, subTotal: fmt(b.totals.subTotal),
      gstTotal: fmt(b.totals.gstTotal),
      overallDiscount: fmt(b.totals.overallDiscount),
      grandTotal: fmt(b.totals.grand),
      paidAmount: fmt(b.totals.paid), changeDue: fmt(b.totals.change)
    };
    Object.entries(map).forEach(([k,v]) => {
      tpl.querySelectorAll(`[data-bind="${k}"]`).forEach(n => n.textContent = v);
    });
    const rowsWrap = tpl.querySelector('[data-bind="rows"]');
    b.items.forEach((r,i)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i+1}</td><td>${r.name}</td>
        <td class="right">${r.qty}</td><td>${r.unit}</td>
        <td class="right">${fmt(r.rate)}</td>
        <td class="right">${r.gst}</td>
        <td class="right">${r.disc}</td>
        <td class="right">${fmt(r.amount)}</td>
      `;
      rowsWrap.appendChild(tr);
    });

    const holder = document.createElement("div");
    holder.className = "print-only";
    holder.style.display = "none";
    holder.appendChild(tpl);
    document.body.appendChild(holder);
    window.print();
    setTimeout(()=> holder.remove(), 500);
  }

  // ---------- Keyboard Shortcuts ----------
  document.addEventListener("keydown", (e)=>{
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    if ((isMac?e.metaKey:e.ctrlKey) && e.key.toLowerCase()==="p") {
      e.preventDefault(); printInvoice();
    }
    if (e.altKey && e.key.toLowerCase()==="n") { e.preventDefault(); resetBill(); }
    if (e.altKey && e.key.toLowerCase()==="s") { e.preventDefault(); saveBill(); }
    if (e.altKey && e.key.toLowerCase()==="e") { e.preventDefault(); exportCSV(); }
    if (e.altKey && e.key.toLowerCase()==="q") { e.preventDefault(); quickItemBtn.click(); }
    if (e.altKey && e.key.toLowerCase()==="d") { e.preventDefault(); toggleTheme.click(); }
    if (e.key==="/") { e.preventDefault(); searchRows.focus(); }
  });

  // ---------- Wire buttons ----------
  newBillBtn.addEventListener("click", ()=> resetBill());
  saveBillBtn.addEventListener("click", saveBill);
  exportCsvBtn.addEventListener("click", exportCSV);
  printBtn.addEventListener("click", printInvoice);

  // ---------- Init ----------
  function initFromQuery() {
    // allow prefill via URL params (optional)
    const p = new URLSearchParams(location.search);
    if (p.get("customer")) customerName.value = p.get("customer");
    if (p.get("phone")) customerPhone.value = p.get("phone");
  }

  function autoRateOnUnitChange() {
    // if unit changed, but rate is empty, attempt to fill from inventory match
    itemUnit.addEventListener("change", ()=>{
      if (!itemRate.value && itemName.value) fillFromInventory(itemName.value);
    });
  }

  function validatePhone() {
    customerPhone.addEventListener("blur", ()=>{
      const v = customerPhone.value.trim();
      if (v && !/^[0-9]{10}$/.test(v)) {
        alert("Please enter a valid 10-digit phone number.");
        customerPhone.focus();
      }
    });
  }

  function start() {
    resetBill();
    renderSaved();
    initFromQuery();
    autoRateOnUnitChange();
    validatePhone();
  }

  start();
})();
