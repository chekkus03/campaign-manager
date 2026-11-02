const DEFAULT_CATALOG = [
      { id: "inf_line", category: "Infantry", name: "Line Rifle Squad", mobility: "Foot", fp: 2, at: 0, flak: 0, def: 1, notes: "Standard rifle squad" },
      { id: "inf_smg", category: "Infantry", name: "SMG / Assault Section", mobility: "Foot", fp: 3, at: 0, flak: 0, def: 1, notes: "Close quarters assault" },
      { id: "inf_at", category: "Infantry", name: "Anti-Tank / AT Team", mobility: "Foot", fp: 1, at: 3, flak: 0, def: 1, notes: "Anti-tank asset" },
      { id: "arm_med", category: "Armored", name: "Medium Tank (Sherman / Pz IV)", mobility: "Armored", fp: 5, at: 6, flak: 1, def: 5, notes: "Main battle tank" },
      { id: "arm_heavy", category: "Armored", name: "Heavy Tank (Tiger / Firefly / Panther)", mobility: "Armored", fp: 7, at: 8, flak: 1, def: 7, notes: "Heavy breakthrough tank" }
    ];

    let battalionTypesList = [
      "Infantry",
      "Armored Infantry",
      "Tank",
      "Reconnaissance",
      "Field Artillery",
      "Tank Destroyer",
      "Combat Engineer"
    ];

    const MOBILITY_HIERARCHY = { "Foot": 1, "Motorized": 2, "Mechanized": 3, "Armored": 4 };

    const TF_NAMES = ["Able", "Baker", "Charlie", "Dog", "Easy", "Fox", "George", "How", "Item", "Jig", "King", "Love"];

const NATION_FLAGS = {}; // flags removed for now; see assets/flags when added

    let campaignData = null;
    let appSettings = { enforceRegRules: true, enforceDivRules: true };
    let activeNavigation = { view: 'campaign', corpsIdx: null, divIdx: null, regIdx: null, tfIdx: null };
    let currentCatalog = [...DEFAULT_CATALOG];
    let tfAttachViewMode = 'grid';

    let pendingDetachData = { cIdx: null, dIdx: null, rIdx: null, bIdx: null };

    const ROMAN_NUMERALS_MAP = {
      1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 
      6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X", 11: "XI"
    };

    function getRomanNumeral(val) {
      const num = parseInt(val);
      return ROMAN_NUMERALS_MAP[num] || val || "I";
    }

    function getOrdinalSuffix(n) {
      const s = ["th", "st", "nd", "rd"],
            v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    function formatCorpsDesignation(corps) {
      const roman = getRomanNumeral(corps.idNum);
      return `${roman} Corps`;
    }

    function formatDivisionDesignation(div) {
      const num = parseInt(div.idNum) || 1;
      const suff = getOrdinalSuffix(num);
      const type = div.divType || "";
      return type ? `${suff} ${type} Division` : `${suff} Division`;
    }

    function formatRegimentDesignation(reg) {
      const num = parseInt(reg.idNum) || 1;
      const suff = getOrdinalSuffix(num);
      const type = reg.regType || "";
      return type ? `${suff} ${type} Regiment` : `${suff} Regiment`;
    }

    function formatBattalionDesignation(bat) {
      const num = parseInt(bat.idNum) || 1;
      const suff = getOrdinalSuffix(num);
      const type = bat.batType || "Unassigned";
      return bat.batType ? `${suff} Battalion, ${type}` : `${suff} Battalion (Unassigned)`;
    }

    function getTaskforceDesignation(tfIdx, nickname) {
      const cycleLen = TF_NAMES.length;
      const baseName = TF_NAMES[tfIdx % cycleLen];
      const cycleNum = Math.floor(tfIdx / cycleLen);
      const romanCycle = cycleNum > 0 ? ` ${getRomanNumeral(cycleNum + 1)}` : ``;
      const nickStr = nickname && nickname.trim() ? ` "${nickname.trim()}"` : ``;
      return `${baseName}${romanCycle}${nickStr}`;
    }

    function openGoogleDrivePicker() {
      const sheetName = prompt("Enter Google Drive File Name or ID to Load Roster JSON:", "Western_Front_Campaign.json");
      if (!sheetName) return;
      
      campaignData = {
        name: sheetName.replace('.json', '').replace(/_/g, ' '),
        nation: "Canada",
        corps: [],
        taskforces: [],
        log: []
      };
      document.getElementById('splash-screen').classList.add('hidden');
      navigateTo('campaign');
      renderSidebar();
      logEvent(`Successfully loaded campaign "${campaignData.name}" from Google Drive.`);
    }

    function openSaveModal() { document.getElementById('save-modal').classList.remove('hidden'); }
    function toggleCodexModal() { document.getElementById('codex-modal').classList.toggle('hidden'); }
    
    function executeSave(destination) {
      document.getElementById('save-modal').classList.add('hidden');
      if (destination === 'local') {
        saveToGoogleDrive();
      } else {
        alert("Simulating Google Drive cloud sync write complete successfully.");
        logEvent("Campaign saved to Google Drive integration.");
      }
    }

    function showNewCampaignModal() { document.getElementById('new-campaign-modal').classList.remove('hidden'); }
    function hideNewCampaignModal() { document.getElementById('new-campaign-modal').classList.add('hidden'); }
    function toggleSettingsModal() { 
      document.getElementById('settings-modal').classList.toggle('hidden'); 
      if (!document.getElementById('settings-modal').classList.contains('hidden')) {
        document.getElementById('setting-enforce-reg-rules').checked = appSettings.enforceRegRules;
        document.getElementById('setting-enforce-div-rules').checked = appSettings.enforceDivRules;
        renderCatalogTextarea();
        renderCombatLog();
      }
    }

    function initiateNewCampaign() {
      const name = document.getElementById('new-camp-name').value.trim() || "Untitled Campaign";
      const nation = document.getElementById('new-camp-nation').value;

      campaignData = {
        name: name,
        nation: nation,
        corps: [],
        taskforces: [],
        log: []
      };

      hideNewCampaignModal();
      document.getElementById('splash-screen').classList.add('hidden');
      navigateTo('campaign');
      renderSidebar();
      logEvent(`Campaign "${name}" created for ${nation}.`);
    }

    function exitToSplash() {
      if (confirm("Return to main menu? Ensure you have saved your campaign.")) {
        campaignData = null;
        document.getElementById('splash-screen').classList.remove('hidden');
      }
    }

    function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }

    function renderSidebarFlag() {
      const imgEl = document.getElementById('sidebar-flag-img');
      if (campaignData && NATION_FLAGS[campaignData.nation]) {
        imgEl.src = NATION_FLAGS[campaignData.nation];
        imgEl.style.display = 'block';
      } else {
        imgEl.style.display = 'none';
      }
    }

    function navigateTo(view, cIdx = null, dIdx = null, rIdx = null, tfIdx = null) {
      activeNavigation = { view, corpsIdx: cIdx, divIdx: dIdx, regIdx: rIdx, tfIdx };
      updateAllHierarchyAutoTypes();
      renderBreadcrumbs();
      renderEchelonView();
      renderSidebar();
    }

    function updateAllHierarchyAutoTypes() {
      if (!campaignData) return;
      campaignData.corps.forEach((c, cIdx) => {
        c.divisions.forEach((d, dIdx) => {
          d.regiments.forEach(r => {
            let evaluatedReg = evaluateRegimentType(r.battalions);
            if (evaluatedReg === "Mixed" && appSettings.enforceRegRules) {
              r.regType = "Invalid/Mixed";
              r.isMixedWarning = true;
            } else if (evaluatedReg === "Mixed") {
              r.regType = "Mixed";
              r.isMixedWarning = true;
            } else {
              r.regType = evaluatedReg;
              r.isMixedWarning = false;
            }
          });

          let evaluatedDiv = evaluateDivisionType(d.regiments);
          if (evaluatedDiv === "Mixed" && appSettings.enforceDivRules && !d.allowMixed) {
            d.divType = "Invalid/Mixed";
            d.isMixedWarning = true;
          } else if (evaluatedDiv === "Mixed") {
            d.divType = "Mixed";
            d.isMixedWarning = true;
          } else {
            d.divType = evaluatedDiv;
            d.isMixedWarning = false;
          }
        });
      });
    }

    function renderBreadcrumbs() {
      const bar = document.getElementById('breadcrumb-bar');
      if (!campaignData) return;
      bar.innerHTML = `<a onclick="navigateTo('campaign')">${campaignData.name || 'Campaign'}</a>`;

      if (activeNavigation.view === 'taskforce_sheet') {
        const tf = campaignData.taskforces[activeNavigation.tfIdx];
        bar.innerHTML += ` &gt; <span style="color: var(--text-color);">${getTaskforceDesignation(activeNavigation.tfIdx, tf.nickname)}</span>`;
        return;
      }
      if (activeNavigation.corpsIdx !== null) {
        const c = campaignData.corps[activeNavigation.corpsIdx];
        bar.innerHTML += ` &gt; <a onclick="navigateTo('corps', ${activeNavigation.corpsIdx})">${formatCorpsDesignation(c)}</a>`;
      }
      if (activeNavigation.divIdx !== null) {
        const c = campaignData.corps[activeNavigation.corpsIdx];
        const d = c.divisions[activeNavigation.divIdx];
        bar.innerHTML += ` &gt; <a onclick="navigateTo('division', ${activeNavigation.corpsIdx}, ${activeNavigation.divIdx})">${formatCorpsDesignation(c)} > ${formatDivisionDesignation(d)}</a>`;
      }
      if (activeNavigation.regIdx !== null) {
        const c = campaignData.corps[activeNavigation.corpsIdx];
        const d = c.divisions[activeNavigation.divIdx];
        const r = d.regiments[activeNavigation.regIdx];
        bar.innerHTML += ` &gt; <span style="color: var(--text-color);">${formatCorpsDesignation(c)} > ${formatDivisionDesignation(d)} > ${formatRegimentDesignation(r)}</span>`;
      }
    }

    function renderSidebar() {
      if (!campaignData) return;
      updateAllHierarchyAutoTypes();
      document.getElementById('sidebar-campaign-title').innerText = campaignData.name;
      document.getElementById('sidebar-nation-title').innerText = `Nation: ${campaignData.nation}`;
      renderSidebarFlag();

      const tree = document.getElementById('sidebar-tree');
      tree.innerHTML = '';

      campaignData.corps.forEach((c, cIdx) => {
        const corpsStr = formatCorpsDesignation(c);
        const cEl = document.createElement('div');
        cEl.className = 'tree-item' + (activeNavigation.view === 'corps' && activeNavigation.corpsIdx === cIdx ? ' active' : '');
        cEl.innerHTML = `<span>${corpsStr}</span>`;
        cEl.onclick = () => navigateTo('corps', cIdx);
        tree.appendChild(cEl);

        const cNode = document.createElement('div');
        cNode.className = 'tree-node';

        c.divisions.forEach((d, dIdx) => {
          const divStr = formatDivisionDesignation(d);
          const combinedDivName = `${corpsStr} > ${divStr}`;
          const dEl = document.createElement('div');
          dEl.className = 'tree-item' + (activeNavigation.view === 'division' && activeNavigation.corpsIdx === cIdx && activeNavigation.divIdx === dIdx ? ' active' : '') + (divisionIsIllegal(d) ? ' bad' : '');
          dEl.innerHTML = `<span>${combinedDivName}</span>`;
          dEl.onclick = (e) => { e.stopPropagation(); navigateTo('division', cIdx, dIdx); };
          cNode.appendChild(dEl);

          const dNode = document.createElement('div');
          dNode.className = 'tree-node';

          d.regiments.forEach((r, rIdx) => {
            const regStr = formatRegimentDesignation(r);
            const combinedRegName = `${corpsStr} > ${divStr} > ${regStr}`;
            const rEl = document.createElement('div');
            rEl.className = 'tree-item' + (activeNavigation.view === 'regiment' && activeNavigation.corpsIdx === cIdx && activeNavigation.divIdx === dIdx && activeNavigation.regIdx === rIdx ? ' active' : '') + (divisionIsIllegal(d) ? ' bad' : '');
            rEl.innerHTML = `<span>${combinedRegName}</span>`;
            rEl.onclick = (e) => { e.stopPropagation(); navigateTo('regiment', cIdx, dIdx, rIdx); };
            dNode.appendChild(rEl);

            const bNode = document.createElement('div');
            bNode.className = 'tree-node';
            r.battalions.forEach((b, bIdx) => {
              const batStr = formatBattalionDesignation(b);
              const bEl = document.createElement('div');
              bEl.className = 'tree-item' + (divisionIsIllegal(d) ? ' bad' : '');
              bEl.innerHTML = `<span>${batStr} ${b.detached ? '<span class="detached-badge">Detached</span>' : ''}</span>`;
              bEl.onclick = (e) => { e.stopPropagation(); navigateTo('regiment', cIdx, dIdx, rIdx); };
              bNode.appendChild(bEl);
            });
            dNode.appendChild(bNode);
          });
          cNode.appendChild(dNode);
        });
        tree.appendChild(cNode);
      });

      const tfSidebar = document.getElementById('sidebar-taskforces');
      tfSidebar.innerHTML = (campaignData.taskforces || []).map((tf, tfIdx) => 
        `<div class="tree-item${activeNavigation.view === 'taskforce_sheet' && activeNavigation.tfIdx === tfIdx ? ' active' : ''}" onclick="navigateTo('taskforce_sheet', null, null, null, ${tfIdx})">
          <span>${getTaskforceDesignation(tfIdx, tf.nickname)}</span>
        </div>`
      ).join('');
    }

    function renderEchelonView() {
      updateAllHierarchyAutoTypes();
      const container = document.getElementById('echelon-view-container');
      container.innerHTML = '';
      const { view, corpsIdx: cIdx, divIdx: dIdx, regIdx: rIdx, tfIdx } = activeNavigation;

      if (view === 'campaign') {
        container.innerHTML = `
          <div class="echelon-header">
            <h2>Campaign Master Operational Command</h2>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Faction: ${campaignData.nation}</p>
          </div>
          
          <div class="toolbar">
            <h3>Corps Formations (${campaignData.corps.length} / 3 Max)</h3>
            ${campaignData.corps.length < 3 ? `<button class="primary" onclick="addCorps()">+ Add Corps</button>` : `<span style="font-size:0.8rem; color:var(--text-muted);">Max Corps Reached</span>`}
          </div>
          <div class="grid-container">
            ${campaignData.corps.map((c, i) => `
              <div class="card">
                <div class="card-header">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <label>ID (1-11):</label>
                    <input type="number" min="1" max="11" value="${c.idNum}" oninput="campaignData.corps[${i}].idNum = parseInt(this.value)||1; renderSidebar();" style="width: 70px;">
                    <span style="font-weight:bold;">Corps</span>
                  </div>
                  <button class="danger" style="padding:2px 6px;" onclick="removeCorps(${i})">×</button>
                </div>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Designation: ${formatCorpsDesignation(c)}</p>
                <p style="font-size:0.8rem; color:var(--text-muted);">Divisions Attached: ${c.divisions.length} / 4</p>
                <button class="primary" style="margin-top:4px;" onclick="navigateTo('corps', ${i})">Open Corps Sheet</button>
              </div>
            `).join('')}
          </div>

          <div class="section-header-line">
            <div class="toolbar">
              <h3>Operational Task Forces (${(campaignData.taskforces || []).length} / 8 Max)</h3>
              ${((campaignData.taskforces || []).length < 8) ? `<button class="primary" onclick="addTaskForce()">+ Create Task Force</button>` : `<span style="font-size:0.8rem; color:var(--text-muted);">Max Taskforces Reached</span>`}
            </div>
          </div>

          <div class="grid-container">
            ${(campaignData.taskforces || []).map((tf, i) => `
              <div class="card">
                <div class="card-header">
                  <div style="display:flex; flex-direction:column; gap:4px; width:100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-weight:bold;">${getTaskforceDesignation(i, tf.nickname)}</span>
                      <button class="danger" style="padding:2px 6px;" onclick="removeTaskForce(${i})">×</button>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                      <label>Nickname:</label>
                      <input type="text" value="${tf.nickname || ''}" placeholder="e.g. Spearhead" oninput="campaignData.taskforces[${i}].nickname = this.value; renderSidebar();" style="flex:1;">
                    </div>
                  </div>
                </div>
                <button class="primary" style="margin-top:6px;" onclick="navigateTo('taskforce_sheet', null, null, null, ${i})">Open Task Force Sheet</button>
              </div>
            `).join('')}
            ${(!campaignData.taskforces || campaignData.taskforces.length === 0) ? `<p style="color:var(--text-muted); font-size:0.85rem;">No task forces created yet.</p>` : ''}
          </div>
        `;
      } else if (view === 'corps') {
        const c = campaignData.corps[cIdx];
        container.innerHTML = `
          <div class="echelon-header"><h2>Corps Sheet: ${formatCorpsDesignation(c)}</h2></div>
          <div class="toolbar">
            <h3>Divisions Attached (${c.divisions.length} / 4 Max)</h3>
            ${c.divisions.length < 4 ? `<button class="primary" onclick="addDivision(${cIdx})">+ Add Division</button>` : `<span style="font-size:0.8rem; color:var(--text-muted);">Max Divisions Reached</span>`}
          </div>
          <div class="grid-container">
            ${c.divisions.map((d, i) => `
              <div class="card">
                <div class="card-header">
                  <div style="display:flex; flex-direction:column; gap:4px; width:100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-weight:bold;">${formatDivisionDesignation(d)}</span>
                      <button class="danger" style="padding:2px 6px;" onclick="removeDivision(${cIdx}, ${i})">×</button>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center;">
                      <label>ID (1-106):</label>
                      <input type="number" min="1" max="106" value="${d.idNum}" oninput="campaignData.corps[${cIdx}].divisions[${i}].idNum = parseInt(this.value)||1; renderSidebar();" style="width:70px;">
                      <label>Type:</label>
                      <input type="text" readonly value="${d.divType || ''}" placeholder="Autofilled" style="flex:1; background:var(--panel-bg); color:var(--text-muted);">
                    </div>
                  </div>
                </div>
                ${divisionIsIllegal(d) ? `<div class="warning-banner" style="margin-top:8px; margin-bottom:0; font-size:0.75rem; background-color:#7f1d1d; color:#fecaca;">⛔ Illegal division (Allow Mixed is off).</div>` : (d.isMixedWarning ? `<div class="warning-banner" style="margin-top:8px; margin-bottom:0; font-size:0.75rem;">⚠️ Warning: Mixed Division classification active.</div>` : '')}
                <p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px;">Regiments Attached: ${d.regiments.length} / 3</p>
                <button class="primary" style="margin-top:4px;" onclick="navigateTo('division', ${cIdx}, ${i})">Open Division Sheet</button>
              </div>
            `).join('')}
          </div>
        `;
      } else if (view === 'division') {
        renderDivisionSheet(cIdx, dIdx);
      } else if (view === 'regiment') {
        renderRegimentSheet(cIdx, dIdx, rIdx);
      } else if (view === 'taskforce_sheet') {
        renderTaskForceSheet(tfIdx);
      }
    }

    function renderDivisionSheet(cIdx, dIdx) {
      updateAllHierarchyAutoTypes();
      const container = document.getElementById('echelon-view-container');
      const c = campaignData.corps[cIdx];
      const d = c.divisions[dIdx];
      const combinedDivPath = `${formatCorpsDesignation(c)}`;

      container.innerHTML = `
        <div class="echelon-header">
          <div class="header-grid">
            <div class="field-group">
              <label>Division Designation (${combinedDivPath})</label>
              <div style="display:flex; gap:6px; align-items:center;">
                <label>ID (1-106):</label>
                <input type="number" min="1" max="106" value="${d.idNum}" oninput="campaignData.corps[${cIdx}].divisions[${dIdx}].idNum = parseInt(this.value)||1; renderSidebar();" style="width:70px;">
                <label>Type:</label>
                <input type="text" readonly value="${d.divType || ''}" placeholder="Autofilled" style="flex:1; background:var(--panel-bg); color:var(--text-muted);">
              </div>
            </div>
            <div class="field-group" style="justify-content: flex-end;">
              <label style="margin-bottom: 4px;">Division Classification Options</label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.85rem; text-transform:none; color:var(--text-color);">
                <input type="checkbox" ${d.allowMixed ? 'checked' : ''} onchange="campaignData.corps[${cIdx}].divisions[${dIdx}].allowMixed = this.checked; updateAllHierarchyAutoTypes(); renderDivisionSheet(${cIdx}, ${dIdx}); renderSidebar();"> Allow Mixed Division Catch-All
              </label>
            </div>
          </div>

          ${divisionIsIllegal(d) ? illegalDivisionBanner(d, 'division') : (d.isMixedWarning ? `<div class="warning-banner">⚠️ Warning: Division layout does not match standard 3x3 combat criteria. Classified as Mixed.</div>` : '')}
        </div>

        <div class="toolbar">
          <h3>Regiments Attached (${d.regiments.length} / 3 Max)</h3>
          ${d.regiments.length < 3 ? `<button class="primary" onclick="addRegiment(${cIdx}, ${dIdx})">+ Add Regiment</button>` : `<span style="font-size:0.8rem; color:var(--text-muted);">Max Regiments Reached</span>`}
        </div>

        <div class="grid-container" id="division-regiments-grid"></div>
      `;

      renderDivisionRegimentCards(cIdx, dIdx);
    }

    function renderDivisionRegimentCards(cIdx, dIdx) {
      const regGrid = document.getElementById('division-regiments-grid');
      const d = campaignData.corps[cIdx].divisions[dIdx];
      regGrid.innerHTML = '';

      d.regiments.forEach((r, i) => {
        const card = document.createElement('div');
        card.className = 'card';

        card.innerHTML = `
          <div class="card-header">
            <div style="display:flex; flex-direction:column; gap:4px; width:100%;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold;">${formatRegimentDesignation(r)}</span>
                <button class="danger" style="padding:2px 6px;" onclick="removeRegiment(${cIdx}, ${dIdx}, ${i})">×</button>
              </div>
              <div style="display:flex; gap:6px; align-items:center;">
                <label>ID (1-700):</label>
                <input type="number" min="1" max="700" value="${r.idNum}" oninput="campaignData.corps[${cIdx}].divisions[${dIdx}].regiments[${i}].idNum = parseInt(this.value)||1; renderSidebar();" style="width:70px;">
                <label>Type:</label>
                <input type="text" readonly value="${r.regType || ''}" placeholder="Autofilled from Battalions" style="flex:1; background:var(--panel-bg); color:var(--text-muted);">
              </div>
            </div>
          </div>
          <p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px;">Battalions Created: ${r.battalions.length} / 3</p>
          <button class="primary" style="margin-top:4px;" onclick="navigateTo('regiment', ${cIdx}, ${dIdx}, ${i})">Open Regiment Sheet</button>
        `;
        regGrid.appendChild(card);
      });
    }

    function renderTaskForceSheet(tfIdx) {
      const container = document.getElementById('echelon-view-container');
      const tf = campaignData.taskforces[tfIdx];
      const tfNameStr = getTaskforceDesignation(tfIdx, tf.nickname);

      let attachedRefList = [];
      let tfStepsCurr = 0, tfStepsMax = 0, tfFP = 0, tfAT = 0, tfFLAK = 0, tfDEF = 0;
      let slowestRank = 999, slowestName = "N/A";

      campaignData.corps.forEach((c, cIdx) => {
        c.divisions.forEach((d, dIdx) => {
          d.regiments.forEach((r, rIdx) => {
            r.battalions.forEach((b, bIdx) => {
              if (b.detached && b.assignedTaskForceIndex == tfIdx) {
                const combinedRegName = `${formatCorpsDesignation(c)} > ${formatDivisionDesignation(d)} > ${formatRegimentDesignation(r)}`;
                attachedRefList.push({ b, cIdx, dIdx, rIdx, bIdx, combinedRegName });

                b.items.forEach(item => {
                  const u = currentCatalog.find(cat => cat.id === item.typeId) || currentCatalog[0];
                  if (u) {
                    tfStepsCurr += item.curr;
                    tfStepsMax += item.max;
                    tfFP += u.fp * item.curr;
                    tfAT += u.at * item.curr;
                    tfFLAK += u.flak * item.curr;
                    tfDEF += u.def * item.curr;
                    const rank = MOBILITY_HIERARCHY[u.mobility] || 1;
                    if (rank < slowestRank) { slowestRank = rank; slowestName = u.mobility; }
                  }
                });
              }
            });
          });
        });
      });

      container.innerHTML = `
        <div class="echelon-header">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
            <h2>Task Force Sheet: ${tfNameStr}</h2>
            <div style="display:flex; gap:6px; align-items:center;">
              <label>Nickname:</label>
              <input type="text" value="${tf.nickname || ''}" placeholder="e.g. Spearhead" oninput="campaignData.taskforces[${tfIdx}].nickname = this.value; renderSidebar();" style="width: 180px;">
            </div>
          </div>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">Independent Combat Grouping (Cap: ${attachedRefList.length} / 3 Battalions)</p>

          <div class="stat-display-grid">
            <div class="stat-box"><span class="val">${tfStepsCurr} / ${tfStepsMax}</span><span class="lbl">Attached Steps</span></div>
            <div class="stat-box"><span class="val">${tfFP}</span><span class="lbl">TF FP</span></div>
            <div class="stat-box"><span class="val">${tfAT}</span><span class="lbl">TF AT</span></div>
            <div class="stat-box"><span class="val">${tfFLAK}</span><span class="lbl">TF FLAK</span></div>
            <div class="stat-box"><span class="val">${tfDEF}</span><span class="lbl">TF DEF</span></div>
            <div class="stat-box"><span class="val" style="color:#ef4444;">${slowestName}</span><span class="lbl">Bottleneck</span></div>
          </div>
        </div>

        <div class="toolbar">
          <h3>Attached Battalions (${attachedRefList.length} / 3 Max)</h3>
        </div>

        <div class="grid-container" id="tf-battalions-grid"></div>

        <div class="section-header-line">
          <div class="toolbar" style="margin-bottom:0; background:transparent; border:none; padding:0;">
            <h3>Attach Available Battalions from Campaign</h3>
            <div class="btn-group">
              <button class="${tfAttachViewMode === 'grid' ? 'primary' : ''}" onclick="tfAttachViewMode='grid'; renderTaskForceSheet(${tfIdx});">Grid View</button>
              <button class="${tfAttachViewMode === 'list' ? 'primary' : ''}" onclick="tfAttachViewMode='list'; renderTaskForceSheet(${tfIdx});">List View</button>
            </div>
          </div>
        </div>
        <div id="available-battalions-container" style="margin-top:10px;"></div>
      `;

      const tfGrid = document.getElementById('tf-battalions-grid');
      if (attachedRefList.length === 0) {
        tfGrid.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">No battalions currently attached to this task force.</p>`;
      } else {
        attachedRefList.forEach(ref => {
          const { b, cIdx, dIdx, rIdx, bIdx, combinedRegName } = ref;
          const batStr = formatBattalionDesignation(b);
          const card = document.createElement('div');
          card.className = 'card';

          card.innerHTML = `
            <div class="card-header">
              <div style="display:flex; flex-direction:column; gap:4px; width:100%;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight: bold;">${batStr}</span>
                  <button class="danger" style="padding:2px 6px;" onclick="detachBattalionFromTF(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx}); renderTaskForceSheet(${tfIdx}); renderSidebar();">Detach</button>
                </div>
              </div>
            </div>
            <p style="font-size:0.75rem; color:var(--text-muted);">From: ${combinedRegName}</p>

            <table>
              <thead><tr><th>Squad</th><th>Steps</th><th>FP</th><th>AT</th><th>Action</th></tr></thead>
              <tbody id="tf-b-rows-${cIdx}-${dIdx}-${rIdx}-${bIdx}"></tbody>
            </table>
            <button onclick="addSquadToBattalion(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx}); renderTaskForceSheet(${tfIdx});">+ Add Squad</button>
          `;
          tfGrid.appendChild(card);

          const tbody = document.getElementById(`tf-b-rows-${cIdx}-${dIdx}-${rIdx}-${bIdx}`);
          b.items.forEach((item, iIdx) => {
            const u = currentCatalog.find(cat => cat.id === item.typeId) || currentCatalog[0];
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>
                <select onchange="campaignData.corps[${cIdx}].divisions[${dIdx}].regiments[${rIdx}].battalions[${bIdx}].items[${iIdx}].typeId = this.value; renderTaskForceSheet(${tfIdx});">
                  ${currentCatalog.map(cat => `<option value="${cat.id}" ${cat.id === item.typeId ? 'selected' : ''}>${cat.name}</option>`).join('')}
                </select>
              </td>
              <td>
                <div class="stepper">
                  <button class="stepper-btn" onclick="adjustSquadStep(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx}, ${iIdx}, -1); renderTaskForceSheet(${tfIdx});">-</button>
                  <span class="qty-val">${item.curr}</span>
                  <button class="stepper-btn" onclick="adjustSquadStep(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx}, ${iIdx}, 1); renderTaskForceSheet(${tfIdx});">+</button>
                </div>
              </td>
              <td>${u ? u.fp * item.curr : 0}</td>
              <td>${u ? u.at * item.curr : 0}</td>
              <td><button class="danger" style="padding:2px 6px;" onclick="removeSquadFromBattalion(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx}, ${iIdx}); renderTaskForceSheet(${tfIdx});">×</button></td>
            `;
            tbody.appendChild(tr);
          });
        });
      }

      const availContainer = document.getElementById('available-battalions-container');
      let unattachedList = [];
      campaignData.corps.forEach((c, cIdx) => {
        c.divisions.forEach((d, dIdx) => {
          d.regiments.forEach((r, rIdx) => {
            r.battalions.forEach((b, bIdx) => {
              if (!b.detached) {
                let stepsCurr = 0, stepsMax = 0, bFP = 0, bAT = 0, bFLAK = 0, bDEF = 0;
                b.items.forEach(item => {
                  const u = currentCatalog.find(cat => cat.id === item.typeId) || currentCatalog[0];
                  if (u) {
                    stepsCurr += item.curr; stepsMax += item.max;
                    bFP += u.fp * item.curr; bAT += u.at * item.curr;
                    bFLAK += u.flak * item.curr; bDEF += u.def * item.curr;
                  }
                });
                unattachedList.push({ b, cIdx, dIdx, rIdx, bIdx, regName: formatRegimentDesignation(r), stepsCurr, stepsMax, bFP, bAT, bFLAK, bDEF });
              }
            });
          });
        });
      });

      if (unattachedList.length === 0) {
        availContainer.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">No unattached battalions available in campaign regiments.</p>`;
      } else if (tfAttachViewMode === 'grid') {
        let gridHtml = `<div class="grid-container">`;
        unattachedList.forEach(item => {
          const batStr = formatBattalionDesignation(item.b);
          gridHtml += `
            <div class="card" style="background: var(--panel-bg);">
              <div style="font-weight:bold; font-size:0.85rem;">${batStr}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">Parent: ${item.regName}</div>
              <div style="font-size:0.75rem; color:var(--accent-color); margin-top:4px;">Steps: ${item.stepsCurr}/${item.stepsMax} | FP: ${item.bFP} | AT: ${item.bAT} | DEF: ${item.bDEF}</div>
              <button class="primary" style="margin-top:6px;" onclick="attachBattalionToTF(${item.cIdx}, ${item.dIdx}, ${item.rIdx}, ${item.bIdx}, ${tfIdx}); renderTaskForceSheet(${tfIdx}); renderSidebar();">Attach to Taskforce</button>
            </div>
          `;
        });
        gridHtml += `</div>`;
        availContainer.innerHTML = gridHtml;
      } else {
        let listHtml = `<table><thead><tr><th>Battalion Designation</th><th>Parent Regiment</th><th>Steps</th><th>FP</th><th>AT</th><th>DEF</th><th>Action</th></tr></thead><tbody>`;
        unattachedList.forEach(item => {
          const batStr = formatBattalionDesignation(item.b);
          listHtml += `
            <tr>
              <td style="font-weight:bold;">${batStr}</td>
              <td style="color:var(--text-muted);">${item.regName}</td>
              <td>${item.stepsCurr}/${item.stepsMax}</td>
              <td>${item.bFP}</td>
              <td>${item.bAT}</td>
              <td>${item.bDEF}</td>
              <td><button class="primary" style="padding:2px 6px;" onclick="attachBattalionToTF(${item.cIdx}, ${item.dIdx}, ${item.rIdx}, ${item.bIdx}, ${tfIdx}); renderTaskForceSheet(${tfIdx}); renderSidebar();">Attach</button></td>
            </tr>
          `;
        });
        listHtml += `</tbody></table>`;
        availContainer.innerHTML = listHtml;
      }
    }

    function attachBattalionToTF(cIdx, dIdx, rIdx, bIdx, tfIdx) {
      const tf = campaignData.taskforces[tfIdx];
      let currentAttachedCount = 0;
      campaignData.corps.forEach(c => {
        c.divisions.forEach(d => {
          d.regiments.forEach(r => {
            r.battalions.forEach(b => {
              if (b.detached && b.assignedTaskForceIndex == tfIdx) currentAttachedCount++;
            });
          });
        });
      });
      if (currentAttachedCount >= 3) return alert("Task Force has reached its maximum cap of 3 battalions.");
      
      const b = campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx].battalions[bIdx];
      b.detached = true;
      b.assignedTaskForceIndex = tfIdx;
    }

    function detachBattalionFromTF(cIdx, dIdx, rIdx, bIdx) {
      const b = campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx].battalions[bIdx];
      b.detached = false;
      b.assignedTaskForceIndex = null;
    }

    function addTaskForce() {
      if (!campaignData.taskforces) campaignData.taskforces = [];
      if (campaignData.taskforces.length >= 8) return alert("Maximum limit of 8 Task Forces reached.");
      campaignData.taskforces.push({ nickname: "" });
      renderEchelonView();
      renderSidebar();
    }
    function removeTaskForce(idx) {
      campaignData.corps.forEach(c => {
        c.divisions.forEach(d => {
          d.regiments.forEach(r => {
            r.battalions.forEach(b => {
              if (b.assignedTaskForceIndex == idx) {
                b.detached = false;
                b.assignedTaskForceIndex = null;
              } else if (b.assignedTaskForceIndex > idx) {
                b.assignedTaskForceIndex--;
              }
            });
          });
        });
      });
      campaignData.taskforces.splice(idx, 1);
      renderEchelonView();
      renderSidebar();
    }

    function renderRegimentSheet(cIdx, dIdx, rIdx) {
      updateAllHierarchyAutoTypes();
      const container = document.getElementById('echelon-view-container');
      const c = campaignData.corps[cIdx];
      const d = c.divisions[dIdx];
      const r = d.regiments[rIdx];

      const combinedRegPath = `${formatCorpsDesignation(c)} > ${formatDivisionDesignation(d)}`;

      let detachedByTF = {};
      r.battalions.forEach((b, bIdx) => {
        if (b.detached && b.assignedTaskForceIndex !== null && campaignData.taskforces[b.assignedTaskForceIndex]) {
          const tfName = getTaskforceDesignation(b.assignedTaskForceIndex, campaignData.taskforces[b.assignedTaskForceIndex].nickname);
          if (!detachedByTF[tfName]) detachedByTF[tfName] = [];
          detachedByTF[tfName].push({ b, bIdx });
        }
      });

      container.innerHTML = `
        <div class="echelon-header">
          <div class="header-grid">
            <div class="field-group">
              <label>Regiment Designation (${combinedRegPath})</label>
              <div style="display:flex; gap:6px; align-items:center;">
                <label>ID (1-700):</label>
                <input type="number" min="1" max="700" value="${r.idNum}" oninput="campaignData.corps[${cIdx}].divisions[${dIdx}].regiments[${rIdx}].idNum = parseInt(this.value)||1; renderSidebar(); updateAllHierarchyAutoTypes();" style="width:70px;">
                <label>Type:</label>
                <input type="text" readonly value="${r.regType || ''}" placeholder="Autofilled from Battalions" style="flex:1; background:var(--panel-bg); color:var(--text-muted);">
              </div>
            </div>
            <div class="field-group">
              <label>Supply Status</label>
              <select onchange="campaignData.corps[${cIdx}].divisions[${dIdx}].regiments[${rIdx}].supply = this.value; updateRegimentStats(${cIdx}, ${dIdx}, ${rIdx});">
                <option value="Supplied" ${r.supply === 'Supplied' ? 'selected' : ''}>Supplied (100%)</option>
                <option value="LowAmmo" ${r.supply === 'LowAmmo' ? 'selected' : ''}>Low Ammo (-25%)</option>
                <option value="Isolated" ${r.supply === 'Isolated' ? 'selected' : ''}>Isolated (-50%)</option>
              </select>
            </div>
          </div>

          ${illegalDivisionBanner(d, 'regiment')}
          ${r.isMixedWarning ? `<div class="warning-banner">⚠️ Warning: Regiment layout does not match standard 3x3 criteria.</div>` : ''}

          <div class="stat-display-grid">
            <div class="stat-box"><span class="val" id="reg-steps">0 / 0</span><span class="lbl">Active Steps</span></div>
            <div class="stat-box"><span class="val" id="reg-fp">0</span><span class="lbl">FP</span></div>
            <div class="stat-box"><span class="val" id="reg-at">0</span><span class="lbl">AT</span></div>
            <div class="stat-box"><span class="val" id="reg-flak">0</span><span class="lbl">FLAK</span></div>
            <div class="stat-box"><span class="val" id="reg-def">0</span><span class="lbl">DEF</span></div>
            <div class="stat-box"><span class="val" id="reg-mobility" style="color:#ef4444;">N/A</span><span class="lbl">Bottleneck</span></div>
          </div>
        </div>

        <div class="toolbar">
          <h3>Active Battalions (${r.battalions.filter(b => !b.detached).length} / 3 Max)</h3>
          <button class="danger" onclick="openClearRegiment(${cIdx}, ${dIdx}, ${rIdx})">Clear types &amp; squads</button>
          ${r.battalions.length < 3 ? `<button class="primary" onclick="addBattalion(${cIdx}, ${dIdx}, ${rIdx})">+ Create Battalion</button>` : `<span style="font-size:0.8rem; color:var(--text-muted);">Max Battalions Reached</span>`}
        </div>

        <p style="font-size:0.78rem; color:var(--text-muted); margin:0 0 8px 0;">${appSettings.enforceRegRules ? 'Greyed-out battalion types are locked: <b>regiment</b> = no legal regiment can include it with the other battalions, <b>division</b> = it would leave this division with no legal layout.' : 'Composition rules are off (Settings), so any battalion type can be chosen.'} ${possibleRegTypesText(r) ? '<br><b>' + possibleRegTypesText(r) + '</b>' : ''}</p>
        <div class="grid-container" id="regiment-battalions-grid"></div>

        <div class="section-header-line"></div>
        <h3>Detached Battalions (Categorized by Taskforce)</h3>
        <div id="detached-battalions-section">
          ${Object.keys(detachedByTF).length > 0 ? Object.keys(detachedByTF).map(tfName => `
            <h4 style="color: var(--accent-color); margin: 10px 0 6px 0; font-size:0.9rem;">${tfName}</h4>
            <div class="grid-container">
              ${detachedByTF[tfName].map(item => `
                <div class="card" style="border-color: #7c2d12;">
                  <div class="card-header">
                    <span style="font-weight:bold;">${formatBattalionDesignation(item.b)}</span>
                    <span class="detached-badge">Detached</span>
                  </div>
                  <div style="display:flex; gap:6px; align-items:center; margin-top:6px;">
                    <button class="success" style="padding:4px 8px; flex:1;" onclick="reattachBattalion(${cIdx}, ${dIdx}, ${rIdx}, ${item.bIdx})">Reattach to Regiment</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('') : `<p style="color:var(--text-muted); font-size:0.85rem;">No battalions currently detached.</p>`}
        </div>
      `;

      renderBattalionCards(cIdx, dIdx, rIdx);
      updateRegimentStats(cIdx, dIdx, rIdx);
    }

    // --- TYPE RULES (Types.md): Battalion -> Regiment -> Division ---------------------------------
    // A "kind" is [battalion type, truck flag]. The truck flag is a temporary DEBUG tick until squads/vehicles drive it.
    const TRUCK_TYPES = ["Infantry"];
    const REG_RULES = [ // checked in order; the transport rule must come before plain Infantry
      { type: "Motorized",  core: "Infantry",         min: 3, others: [], transport: true },
      { type: "Infantry",   core: "Infantry",         min: 3, others: [] },
      { type: "Mechanized", core: "Armored Infantry", min: 2, others: ["Tank", "Reconnaissance", "Combat Engineer"] },
      { type: "Armored",    core: "Tank",             min: 2, others: ["Armored Infantry", "Tank Destroyer", "Reconnaissance"] },
      { type: "Artillery",  core: "Field Artillery",  min: 2, others: ["Tank Destroyer", "Combat Engineer"] }
    ];
    const REG_TYPE_NAMES = ["Motorized", "Infantry", "Mechanized", "Armored", "Artillery"];
    const DIV_RULES = [ // each row is one legal layout of 3 regiment types (any order)
      { type: "Infantry",   layout: ["Infantry", "Infantry", "Artillery"] },
      { type: "Motorized",  layout: ["Motorized", "Motorized", "Artillery"] },
      { type: "Mechanized", layout: ["Mechanized", "Mechanized", "Artillery"] },
      { type: "Infantry",   layout: ["Mechanized", "Infantry", "Artillery"] }, // override: defaults down to Infantry
      { type: "Armored",    layout: ["Armored", "Mechanized", "Artillery"] },
      { type: "Armored",    layout: ["Armored", "Armored", "Artillery"] }
    ];

    function batKinds() {
      const k = [];
      battalionTypesList.forEach(t => { k.push([t, false]); if (TRUCK_TYPES.includes(t)) k.push([t, true]); });
      return k;
    }

    // The regiment's three battalion slots. Detached and reserve battalions keep their slot: types are static.
    function regimentSlots(r) {
      return [0, 1, 2].map(i => {
        const b = r.battalions[i];
        return (b && b.batType) ? [b.batType, TRUCK_TYPES.includes(b.batType) && !!b.debugTruck] : null;
      });
    }

    function regTypeOfKinds(k) {
      for (const rule of REG_RULES) {
        if (k.filter(x => x[0] === rule.core).length < rule.min) continue;
        if (!k.every(x => x[0] === rule.core || rule.others.includes(x[0]))) continue;
        if (rule.transport && !k.every(x => x[1])) continue;
        return rule.type;
      }
      return null;
    }

    // Every regiment type this regiment can still become, over all ways of filling its empty slots.
    function possRegTypes(slots) {
      const out = new Set(), empty = [], cur = slots.slice(), kinds = batKinds();
      slots.forEach((s, i) => { if (!s) empty.push(i); });
      (function rec(j) {
        if (j === empty.length) { const t = regTypeOfKinds(cur); if (t) out.add(t); return; }
        for (const kd of kinds) { cur[empty[j]] = kd; rec(j + 1); }
        cur[empty[j]] = null;
      })(0);
      return out;
    }

    function divTypeOfNames(types) {
      if (types.some(t => !t)) return null;
      const key = types.slice().sort().join("|");
      const rule = DIV_RULES.find(r => r.layout.slice().sort().join("|") === key);
      return rule ? rule.type : null;
    }

    // Can the three regiments (each limited to its set of possible types) still end in a legal division?
    function divFeasible(sets) {
      for (const a of sets[0]) for (const b of sets[1]) for (const c of sets[2]) if (divTypeOfNames([a, b, c])) return true;
      return false;
    }

    function possibleRegSets(d) {
      return [0, 1, 2].map(i => d.regiments[i] ? possRegTypes(regimentSlots(d.regiments[i])) : new Set(REG_TYPE_NAMES));
    }

    // A division is "illegal" when mixed was allowed, a non-standard layout was built, and mixed was then turned off.
    function divisionIsIllegal(d) {
      if (!d || d.allowMixed || !appSettings.enforceDivRules) return false;
      if (d.divType === "Invalid/Mixed") return true;
      return !divFeasible(possibleRegSets(d)); // not full yet, but no regiment(s) could ever complete a legal layout
    }
    function illegalDivisionBanner(d, here) {
      if (!divisionIsIllegal(d)) return '';
      const t = d.regiments.map(r => r.regType || '?').join(' + ');
      return `<div class="warning-banner" style="background-color:#7f1d1d; color:#fecaca; border:1px solid #ef4444;">⛔ ILLEGAL DIVISION: its regiments (${t}) ${d.regiments.length < 3 || d.regiments.some(r => !r.regType) ? 'cannot be completed into a legal layout' : 'are not a legal layout'}, and "Allow Mixed Division" is OFF. ${here === 'division' ? 'Change a regiment or battalion type, or turn Allow Mixed back on.' : 'This regiment belongs to that division. Fix it from the division or any of its regiments.'}</div>`;
    }

    function divisionStrict(d) { return appSettings.enforceDivRules && !d.allowMixed; }

    // Locked battalion types for one slot: { typeName: "regiment" | "division" }.
    // A type is offered only if some way of filling the remaining slots (this regiment AND its two sibling
    // regiments) still ends in a legal regiment and, when division rules are enforced, a legal division.
    function getBattalionTypeLocks(cIdx, dIdx, rIdx, bIdx) {
      const locks = {};
      if (!appSettings.enforceRegRules) return locks;
      const d = campaignData.corps[cIdx].divisions[dIdx], r = d.regiments[rIdx], cur = r.battalions[bIdx];
      const base = possibleRegSets(d);
      battalionTypesList.forEach(t => {
        if (cur.batType === t) return; // the current choice always stays selectable
        const slots = regimentSlots(r);
        slots[bIdx] = [t, TRUCK_TYPES.includes(t) && !!cur.debugTruck];
        const p = possRegTypes(slots);
        if (p.size === 0) { locks[t] = "regiment"; return; }
        if (divisionStrict(d)) {
          const sets = base.slice(); sets[rIdx] = p;
          if (!divFeasible(sets)) locks[t] = "division";
        }
      });
      return locks;
    }

    function isTruckTickAllowed(cIdx, dIdx, rIdx, bIdx, val) {
      if (!appSettings.enforceRegRules) return true;
      const d = campaignData.corps[cIdx].divisions[dIdx], r = d.regiments[rIdx];
      const slots = regimentSlots(r); if (!slots[bIdx]) return true;
      slots[bIdx] = [slots[bIdx][0], !!val];
      const p = possRegTypes(slots); if (p.size === 0) return false;
      if (!divisionStrict(d)) return true;
      const sets = possibleRegSets(d); sets[rIdx] = p;
      return divFeasible(sets);
    }

    function setBattalionType(cIdx, dIdx, rIdx, bIdx, val) {
      const bn = campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx].battalions[bIdx];
      if (val && getBattalionTypeLocks(cIdx, dIdx, rIdx, bIdx)[val]) {
        alert("That battalion type is locked here. Locked types are greyed out in the list.");
        renderRegimentSheet(cIdx, dIdx, rIdx); return;
      }
      bn.batType = val;
      if (!TRUCK_TYPES.includes(val)) bn.debugTruck = false;
      updateAllHierarchyAutoTypes(); renderRegimentSheet(cIdx, dIdx, rIdx); renderSidebar();
    }

    function setBattalionTruck(cIdx, dIdx, rIdx, bIdx, checked) {
      const bn = campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx].battalions[bIdx];
      if (!isTruckTickAllowed(cIdx, dIdx, rIdx, bIdx, checked)) {
        alert("Locked: that would leave this regiment or division with no legal layout.");
        renderRegimentSheet(cIdx, dIdx, rIdx); return;
      }
      bn.debugTruck = !!checked;
      updateAllHierarchyAutoTypes(); renderRegimentSheet(cIdx, dIdx, rIdx); renderSidebar();
    }

    function possibleRegTypesText(r) {
      const slots = regimentSlots(r);
      if (slots.every(x => x)) return "";
      const p = Array.from(possRegTypes(slots));
      return p.length ? "Still possible: " + p.join(" · ") : "No legal regiment can be built from these battalions";
    }

    // --- CLEAR TYPES & SQUADS (whole regiment) ---
    let pendingClearReg = null;
    function openClearRegiment(cIdx, dIdx, rIdx) {
      pendingClearReg = { cIdx, dIdx, rIdx };
      const c = campaignData.corps[cIdx], d = c.divisions[dIdx], r = d.regiments[rIdx];
      let types = 0, rows = 0, steps = 0;
      r.battalions.forEach(b => { if (b.batType) types++; b.items.forEach(it => { rows++; steps += (it.max || 0); }); });
      document.getElementById('clear-reg-body').innerHTML =
        `<p style="margin-bottom:8px;"><b>This cannot be undone.</b> For ${formatCorpsDesignation(c)} &gt; ${formatDivisionDesignation(d)} &gt; ${formatRegimentDesignation(r)} it will erase:</p>
         <ul style="margin:0 0 10px 18px; font-size:0.85rem; line-height:1.5;">
           <li>the type of all battalions (${types} set) and their DEBUG truck ticks</li>
           <li>every squad and vehicle line in all battalions (${rows} lines, ${steps} total max steps), including current steps</li>
         </ul>
         <p style="font-size:0.8rem; color:var(--text-muted);">It keeps the regiment and battalion ID numbers and any Task Force detachments.</p>`;
      document.getElementById('clear-reg-modal').classList.remove('hidden');
    }
    function closeClearRegiment() { document.getElementById('clear-reg-modal').classList.add('hidden'); pendingClearReg = null; }
    function confirmClearRegiment() {
      if (!pendingClearReg) return;
      const { cIdx, dIdx, rIdx } = pendingClearReg;
      const r = campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx];
      r.battalions.forEach(b => { b.batType = ""; b.debugTruck = false; b.items = []; });
      closeClearRegiment();
      updateAllHierarchyAutoTypes(); renderRegimentSheet(cIdx, dIdx, rIdx); renderSidebar();
    }

    function renderBattalionCards(cIdx, dIdx, rIdx) {
      const bGrid = document.getElementById('regiment-battalions-grid');
      const r = campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx];
      bGrid.innerHTML = '';

      let activeCount = 0;
      r.battalions.forEach((b, bIdx) => {
        if (b.detached) return;
        activeCount++;

        const card = document.createElement('div');
        card.className = 'card';
        const batStr = formatBattalionDesignation(b);

        const typeLocks = getBattalionTypeLocks(cIdx, dIdx, rIdx, bIdx);
        let typeOptions = `<option value="" ${!b.batType ? 'selected' : ''}>-- Select Type --</option>` +
          battalionTypesList.map(t => {
            const lk = typeLocks[t];
            return `<option value="${t}" ${b.batType === t ? 'selected' : ''} ${lk ? 'disabled' : ''}>${t}${lk ? ' \u2014 locked (' + lk + ')' : ''}</option>`;
          }).join('');
        if (b.batType && !battalionTypesList.includes(b.batType)) typeOptions += `<option value="${b.batType}" selected>${b.batType}</option>`;
        const truckTick = TRUCK_TYPES.includes(b.batType)
          ? `<label style="display:inline-flex; gap:5px; align-items:center; color:#f87171; border:1px dashed #f87171; padding:2px 6px; border-radius:3px; font-size:0.7rem; white-space:nowrap;"><input type="checkbox" ${b.debugTruck ? 'checked' : ''} onchange="setBattalionTruck(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx}, this.checked)"> DEBUG: truck transport</label>` : '';

        card.innerHTML = `
          <div class="card-header">
            <div style="display:flex; flex-direction:column; gap:4px; width:100%;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold;">${batStr}</span>
                <button class="danger" style="padding:2px 6px;" onclick="removeBattalion(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx})">×</button>
              </div>
              <div style="display:flex; gap:6px; align-items:center;">
                <label>ID (1-3):</label>
                <input type="number" min="1" max="3" value="${b.idNum}" oninput="campaignData.corps[${cIdx}].divisions[${dIdx}].regiments[${rIdx}].battalions[${bIdx}].idNum = parseInt(this.value)||1; renderRegimentSheet(${cIdx}, ${dIdx}, ${rIdx}); renderSidebar(); updateAllHierarchyAutoTypes();" style="width:70px;">
                <label>Type:</label>
                <select style="flex:1; min-width:0;" onchange="setBattalionType(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx}, this.value);">
                  ${typeOptions}
                </select>
                ${truckTick}
              </div>
            </div>
          </div>

          <div style="display:flex; gap:8px; align-items:center; background:var(--panel-bg); padding:6px; border-radius:4px;">
            <button class="primary" style="flex:1; padding:4px;" onclick="openDetachModal(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx})">Detach to Taskforce...</button>
          </div>

          <table>
            <thead><tr><th>Squad</th><th>Steps</th><th>FP</th><th>AT</th><th>Action</th></tr></thead>
            <tbody id="b-rows-${bIdx}"></tbody>
          </table>
          <button onclick="addSquadToBattalion(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx})">+ Add Squad</button>
        `;
        bGrid.appendChild(card);

        const tbody = document.getElementById(`b-rows-${bIdx}`);
        b.items.forEach((item, iIdx) => {
          const u = currentCatalog.find(cat => cat.id === item.typeId) || currentCatalog[0];
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <select onchange="campaignData.corps[${cIdx}].divisions[${dIdx}].regiments[${rIdx}].battalions[${bIdx}].items[${iIdx}].typeId = this.value; updateRegimentStats(${cIdx}, ${dIdx}, ${rIdx});">
                ${currentCatalog.map(cat => `<option value="${cat.id}" ${cat.id === item.typeId ? 'selected' : ''}>${cat.name}</option>`).join('')}
              </select>
            </td>
            <td>
              <div class="stepper">
                <button class="stepper-btn" onclick="adjustSquadStep(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx}, ${iIdx}, -1)">-</button>
                <span class="qty-val">${item.curr}</span>
                <button class="stepper-btn" onclick="adjustSquadStep(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx}, ${iIdx}, 1)">+</button>
              </div>
            </td>
            <td>${u ? u.fp * item.curr : 0}</td>
            <td>${u ? u.at * item.curr : 0}</td>
            <td><button class="danger" style="padding:2px 6px;" onclick="removeSquadFromBattalion(${cIdx}, ${dIdx}, ${rIdx}, ${bIdx}, ${iIdx})">×</button></td>
          `;
          tbody.appendChild(tr);
        });
      });

      if (activeCount === 0) {
        bGrid.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">No active (non-detached) battalions in this regiment.</p>`;
      }
    }

    // --- EVALUATION LOGIC FOR REGIMENTS & DIVISIONS ---
    function evaluateRegimentType(battalions) {
      if (!battalions || battalions.length < 3) return "";
      const kinds = battalions.slice(0, 3).map(b => b.batType ? [b.batType, TRUCK_TYPES.includes(b.batType) && !!b.debugTruck] : null);
      if (kinds.some(k => !k)) return "";
      return regTypeOfKinds(kinds) || "Mixed";
    }

    function evaluateDivisionType(regiments) {
      if (!regiments || regiments.length < 3) return "";
      const t = regiments.map(r => r.regType || "");
      if (t.some(x => !x || x === "Invalid/Mixed")) return "";
      if (t.some(x => x === "Mixed")) return "Mixed";
      return divTypeOfNames(t) || "Mixed";
    }

    // --- CUSTOM DETACH MODAL LOGIC ---
    function openDetachModal(cIdx, dIdx, rIdx, bIdx) {
      if (!campaignData.taskforces || campaignData.taskforces.length === 0) {
        return alert("Please create a Task Force first before detaching battalions.");
      }
      pendingDetachData = { cIdx, dIdx, rIdx, bIdx };
      
      const selectEl = document.getElementById('detach-tf-select');
      selectEl.innerHTML = campaignData.taskforces.map((tf, idx) => 
        `<option value="${idx}">${getTaskforceDesignation(idx, tf.nickname)}</option>`
      ).join('');

      document.getElementById('detach-modal').classList.remove('hidden');
    }

    function closeDetachModal() {
      document.getElementById('detach-modal').classList.add('hidden');
    }

    function confirmDetachBattalion() {
      const selectEl = document.getElementById('detach-tf-select');
      const tfIdx = parseInt(selectEl.value);
      if (isNaN(tfIdx)) return;

      let currentAttachedCount = 0;
      campaignData.corps.forEach(c => {
        c.divisions.forEach(d => {
          d.regiments.forEach(r => {
            r.battalions.forEach(b => {
              if (b.detached && b.assignedTaskForceIndex == tfIdx) currentAttachedCount++;
            });
          });
        });
      });
      if (currentAttachedCount >= 3) {
        alert("Selected Task Force has reached its maximum cap of 3 battalions.");
        return;
      }

      const { cIdx, dIdx, rIdx, bIdx } = pendingDetachData;
      const b = campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx].battalions[bIdx];
      b.detached = true;
      b.assignedTaskForceIndex = tfIdx;

      closeDetachModal();
      updateAllHierarchyAutoTypes();
      renderRegimentSheet(cIdx, dIdx, rIdx);
      renderSidebar();
    }

    function reattachBattalion(cIdx, dIdx, rIdx, bIdx) {
      const b = campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx].battalions[bIdx];
      b.detached = false;
      b.assignedTaskForceIndex = null;
      updateAllHierarchyAutoTypes();
      renderRegimentSheet(cIdx, dIdx, rIdx);
      renderSidebar();
    }

    function addCorps() { 
      if (campaignData.corps.length >= 3) return alert("Maximum limit of 3 Corps reached.");
      const nextId = campaignData.corps.length + 1;
      campaignData.corps.push({ idNum: nextId, divisions: [] }); 
      navigateTo('campaign'); 
    }
    function removeCorps(i) { campaignData.corps.splice(i, 1); navigateTo('campaign'); }
    
    function addDivision(cIdx) { 
      const c = campaignData.corps[cIdx];
      if (c.divisions.length >= 4) return alert("Maximum limit of 4 Divisions reached.");
      const nextId = c.divisions.length + 1;
      c.divisions.push({ idNum: nextId, divType: "", allowMixed: false, isMixedWarning: false, regiments: [] }); 
      navigateTo('corps', cIdx); 
    }
    function removeDivision(cIdx, i) { campaignData.corps[cIdx].divisions.splice(i, 1); navigateTo('corps', cIdx); }
    
    function addRegiment(cIdx, dIdx) { 
      const d = campaignData.corps[cIdx].divisions[dIdx];
      if (d.regiments.length >= 3) return alert("Maximum limit of 3 Regiments reached.");
      const nextId = d.regiments.length + 1;

      d.regiments.push({ idNum: nextId, regType: "", isMixedWarning: false, supply: 'Supplied', battalions: [] }); 
      updateAllHierarchyAutoTypes();
      navigateTo('division', cIdx, dIdx); 
    }
    function removeRegiment(cIdx, dIdx, i) { 
      campaignData.corps[cIdx].divisions[dIdx].regiments.splice(i, 1); 
      updateAllHierarchyAutoTypes();
      navigateTo('division', cIdx, dIdx); 
    }
    
    function addBattalion(cIdx, dIdx, rIdx) { 
      const r = campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx];
      if (r.battalions.length >= 3) return alert("Maximum limit of 3 Battalions reached.");
      const nextId = r.battalions.length + 1;
      r.battalions.push({ idNum: nextId, batType: "", debugTruck: false, detached: false, assignedTaskForceIndex: null, items: [] }); 
      updateAllHierarchyAutoTypes();
      renderRegimentSheet(cIdx, dIdx, rIdx); 
      renderSidebar();
    }
    function removeBattalion(cIdx, dIdx, rIdx, bIdx) { 
      const r = campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx];
      r.battalions.splice(bIdx, 1);
      r.battalions.forEach((b, idx) => { b.idNum = idx + 1; });
      updateAllHierarchyAutoTypes();
      renderRegimentSheet(cIdx, dIdx, rIdx); 
      renderSidebar();
    }
    
    function addSquadToBattalion(cIdx, dIdx, rIdx, bIdx) { campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx].battalions[bIdx].items.push({ typeId: currentCatalog[0].id, max: 1, curr: 1 }); renderRegimentSheet(cIdx, dIdx, rIdx); }
    function removeSquadFromBattalion(cIdx, dIdx, rIdx, bIdx, iIdx) { campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx].battalions[bIdx].items.splice(iIdx, 1); renderRegimentSheet(cIdx, dIdx, rIdx); }
    function adjustSquadStep(cIdx, dIdx, rIdx, bIdx, iIdx, delta) {
      const item = campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx].battalions[bIdx].items[iIdx];
      item.curr = Math.max(0, Math.min(item.max, item.curr + delta));
      renderRegimentSheet(cIdx, dIdx, rIdx);
    }

    function updateRegimentStats(cIdx, dIdx, rIdx) {
      const r = campaignData.corps[cIdx].divisions[dIdx].regiments[rIdx];
      let stepsCurr = 0, stepsMax = 0, rawFP = 0, rawAT = 0, rawFLAK = 0, rawDEF = 0;
      let slowestRank = 999, slowestName = "N/A";

      r.battalions.forEach(b => {
        if (!b.detached) {
          b.items.forEach(item => {
            const u = currentCatalog.find(cat => cat.id === item.typeId) || currentCatalog[0];
            if (u) {
              stepsCurr += item.curr; stepsMax += item.max;
              rawFP += u.fp * item.curr; rawAT += u.at * item.curr;
              rawFLAK += u.flak * item.curr; rawDEF += u.def * item.curr;
              const rank = MOBILITY_HIERARCHY[u.mobility] || 1;
              if (rank < slowestRank) { slowestRank = rank; slowestName = u.mobility; }
            }
          });
        }
      });

      if (document.getElementById('reg-steps')) {
        document.getElementById('reg-steps').innerText = `${stepsCurr} / ${stepsMax}`;
        document.getElementById('reg-fp').innerText = rawFP;
        document.getElementById('reg-at').innerText = rawAT;
        document.getElementById('reg-flak').innerText = rawFLAK;
        document.getElementById('reg-def').innerText = rawDEF;
        document.getElementById('reg-mobility').innerText = slowestName;
      }
    }

    function saveToGoogleDrive() {
      if (!campaignData) return;
      const jsonStr = JSON.stringify(campaignData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${campaignData.name.replace(/\s+/g, '_')}_Campaign.json`;
      a.click();
      logEvent("Campaign saved to Drive / JSON file.");
    }

    function loadCampaignFromFile(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          campaignData = JSON.parse(evt.target.result);
          document.getElementById('splash-screen').classList.add('hidden');
          navigateTo('campaign');
          renderSidebar();
          logEvent("Loaded campaign from file.");
        } catch (err) { alert("Error parsing JSON file."); }
      };
      reader.readAsText(file);
    }

    function fetchRemoteCatalog() {
      const url = document.getElementById('catalog-url-input').value.trim();
      if (!url) return alert("Please enter a valid CSV URL.");
      fetch(url)
        .then(res => res.text())
        .then(text => { document.getElementById('catalog-textarea').value = text; applyCatalogFromText(); })
        .catch(err => alert("Error fetching CSV: " + err.message));
    }
    function loadCatalogFile(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(evt) { document.getElementById('catalog-textarea').value = evt.target.result; applyCatalogFromText(); };
      reader.readAsText(file);
    }
    function applyCatalogFromText() {
      const text = document.getElementById('catalog-textarea').value.trim();
      const lines = text.split('\n');
      const newCat = [];
      let newBatTypes = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',');
        if (cols.length >= 7) {
          newCat.push({
            id: 'custom_' + i, category: cols[0].trim(), name: cols[1].trim(),
            mobility: cols[2].trim(), fp: parseInt(cols[3]) || 0, at: parseInt(cols[4]) || 0,
            flak: parseInt(cols[5]) || 0, def: parseInt(cols[6]) || 0, notes: cols[7] ? cols[7].trim() : ""
          });
        }
        if (cols.length >= 1 && cols[0].trim() === "BattalionType" && cols[1]) {
          newBatTypes.push(cols[1].trim());
        }
      }
      if (newCat.length > 0) { currentCatalog = newCat; }
      if (newBatTypes.length > 0) { battalionTypesList = newBatTypes; }
      alert("CSV Database & Battalion Types successfully updated!");
    }
    function exportCatalogCSV() {
      let csv = "Category,Name,Mobility,FP,AT,FLAK,DEF,Notes\n";
      currentCatalog.forEach(c => { csv += `${c.category},${c.name},${c.mobility},${c.fp},${c.at},${c.flak},${c.def},${c.notes}\n`; });
      csv += "\n# Battalion Types List below\nBattalionType,TypeName\n";
      battalionTypesList.forEach(t => { csv += `BattalionType,${t}\n`; });
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "Unit_Database_Catalog.csv"; a.click();
    }
    function renderCatalogTextarea() {
      let csv = "Category,Name,Mobility,FP,AT,FLAK,DEF,Notes\n";
      currentCatalog.forEach(c => { csv += `${c.category},${c.name},${c.mobility},${c.fp},${c.at},${c.flak},${c.def},${c.notes}\n`; });
      csv += "\nBattalionType,TypeName\n";
      battalionTypesList.forEach(t => { csv += `BattalionType,${t}\n`; });
      const ta = document.getElementById('catalog-textarea');
      if (ta) ta.value = csv;
    }

    function logEvent(msg) {
      if (!campaignData) return;
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (!campaignData.log) campaignData.log = [];
      campaignData.log.unshift({ time: timeStr, msg });
      renderCombatLog();
    }
    function renderCombatLog() {
      const container = document.getElementById('log-container');
      if (container && campaignData) {
        container.innerHTML = (campaignData.log || []).map(l => `<div>[${l.time}] ${l.msg}</div>`).join('');
      }
    }
    function clearLog() { if (campaignData) { campaignData.log = []; renderCombatLog(); } }
