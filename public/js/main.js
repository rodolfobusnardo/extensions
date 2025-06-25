document.addEventListener('DOMContentLoaded', function() {
    const sectorsContainer = document.getElementById('sectors-container');
    const loadingMessage = document.getElementById('loading-sectors');
    const errorMessageElement = document.getElementById('error-sectors'); // Renomeado para evitar conflito
    const searchInput = document.getElementById('public-search-input');
    const clearSearchBtn = document.getElementById('public-clear-search-btn');

    let fullSectorsDataCache = []; // Cache para os dados completos

    function displayError(message) {
        if (errorMessageElement) {
            errorMessageElement.textContent = message;
            errorMessageElement.style.display = 'block';
        }
        if (loadingMessage) loadingMessage.style.display = 'none';
        if (sectorsContainer) sectorsContainer.innerHTML = '';
    }

    function showLoading(show = true) {
        if (loadingMessage) loadingMessage.style.display = show ? 'block' : 'none';
        if (show) {
            if (sectorsContainer) sectorsContainer.innerHTML = '';
            if (errorMessageElement) errorMessageElement.style.display = 'none';
        }
    }

    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, function (match) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
        });
    }

    function renderSectorsGrid(sectorsData) {
        if (!sectorsContainer) return;
        sectorsContainer.innerHTML = ''; // Limpar antes de renderizar

        if (sectorsData.length === 0 && searchInput && searchInput.value.trim() !== '') {
            // Se não há dados E é resultado de uma busca, mostra mensagem de "nenhum resultado"
             sectorsContainer.innerHTML = `<p style="width:100%; text-align:center;">Nenhum resultado encontrado para "<strong>${escapeHTML(searchInput.value.trim())}</strong>".</p>`;
            return;
        }
        if (sectorsData.length === 0) {
            sectorsContainer.innerHTML = '<p style="width:100%; text-align:center;">Nenhum setor ou ramal cadastrado para exibir.</p>';
            return;
        }

        sectorsData.forEach(sector => {
            const sectorTableWrapper = document.createElement('div');
            sectorTableWrapper.classList.add('sector-table-wrapper');

            const sectorTitle = document.createElement('h4'); // Usando H4 para o nome do setor
            sectorTitle.textContent = escapeHTML(sector.sector_name);
            sectorTableWrapper.appendChild(sectorTitle);

            const table = document.createElement('table');
            table.classList.add('sector-extension-table');

            const thead = table.createTHead();
            const headerRow = thead.insertRow();
            const thName = document.createElement('th');
            thName.textContent = 'Nome';
            headerRow.appendChild(thName);
            const thExtension = document.createElement('th');
            thExtension.textContent = 'Ramal';
            headerRow.appendChild(thExtension);

            const tbody = table.createTBody();
            const membersToShow = sector.members.slice(0, 7); // Limite de 7 membros

            if (membersToShow.length > 0) {
                membersToShow.forEach(member => {
                    const row = tbody.insertRow();
                    const cellName = row.insertCell();
                    cellName.textContent = escapeHTML(member.person_name);
                    const cellExtension = row.insertCell();
                    cellExtension.textContent = member.extension_number ? escapeHTML(member.extension_number) : 'N/A';
                });
            } else {
                const row = tbody.insertRow();
                const cellEmpty = row.insertCell();
                cellEmpty.colSpan = 2;
                cellEmpty.textContent = 'Nenhum membro com ramal neste setor.';
                cellEmpty.style.textAlign = 'center';
                cellEmpty.style.fontStyle = 'italic';
            }

            sectorTableWrapper.appendChild(table);
            sectorsContainer.appendChild(sectorTableWrapper);
        });
    }

    async function fetchDataAndRender(searchTerm = '') {
        showLoading(true);
        try {
            // Se temos cache e não há termo de busca, usamos o cache para a renderização inicial.
            // A busca sempre usará o cache se ele existir.
            if (fullSectorsDataCache.length > 0 && !searchTerm) {
                renderSectorsGrid(fullSectorsDataCache);
                showLoading(false);
                return;
            }

            // Se não há cache ou se uma busca é feita (embora a busca atual seja no cliente),
            // idealmente a busca no servidor seria usada. Por ora, a busca é no cliente.
            // Esta chamada fetch é principalmente para a carga inicial.
            const response = await fetch('/actions/get_public_extensions_by_sector.php');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            const result = await response.json();

            if (result.success && result.data) {
                fullSectorsDataCache = result.data; // Armazena no cache
                if (searchTerm) { // Se havia um termo de busca, aplica-o
                    filterAndRenderData(searchTerm);
                } else {
                    renderSectorsGrid(fullSectorsDataCache);
                }
            } else {
                displayError(result.message || 'Falha ao carregar dados. Resposta do servidor não foi bem-sucedida.');
            }
        } catch (error) {
            console.error('Error fetching data for public list:', error);
            displayError(`Erro de conexão ao tentar carregar os dados: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }

    function filterAndRenderData(term) {
        if (!sectorsContainer) return;
        term = term.toLowerCase().trim();

        if (!term) {
            renderSectorsGrid(fullSectorsDataCache); // Renderiza todos os dados do cache
            return;
        }

        const filteredData = fullSectorsDataCache.map(sector => {
            const matchingMembers = sector.members.filter(member =>
                member.person_name.toLowerCase().includes(term) ||
                (member.extension_number && member.extension_number.toLowerCase().includes(term))
            );

            if (sector.sector_name.toLowerCase().includes(term) || matchingMembers.length > 0) {
                // Se o setor corresponde pelo nome, mostra todos os membros (limitado a 7)
                // Se apenas membros correspondem, mostra apenas esses membros (limitado a 7)
                const membersToDisplay = sector.sector_name.toLowerCase().includes(term) ? sector.members : matchingMembers;
                return { ...sector, members: membersToDisplay };
            }
            return null;
        }).filter(sector => sector !== null);

        renderSectorsGrid(filteredData); // A função renderSectorsGrid já lida com a mensagem de "nenhum resultado" se filteredData for vazio
    }

    let searchTimeout = null;
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                filterAndRenderData(this.value);
            }, 300);
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            if (searchInput) searchInput.value = '';
            filterAndRenderData(''); // Limpa a busca e renderiza tudo
        });
    }

    fetchDataAndRender(); // Chamada inicial para carregar os dados
});
