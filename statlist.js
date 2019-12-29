let cache = {};
let summary = {};
let summaryWithLicense = {};
let currentSector = '';
let neighborSectors = [];
let neighborSectorColor = 'rgb(237, 124, 2)';
let currentSectorColor = 'rgb(255, 4, 4)';
let portSectors = ['52,50', '50,47', '53,53', '49,53', '47,52', '47,49'];
let resourceName = location.href.replace(/.+r=([^\&]+).*/g, '$1');
let transactionID = 0;
const transactionStatusEls = {};
const resInfo = {
    uran: 1,
    metal: 0.5,
    aluminium: 0.5,
    ganjium: 0.5,
    weed: 0.25,
    solomka: 0.25,
    bauxite: 0.5
};
const maxWeightLimit = '153';

function filterMap(x, y, neighbors) {
    return Array.from(document.querySelectorAll('a'))
        .filter(a => {
            if (a.href.indexOf('map.php?sx') !== -1) {
                a.parentNode.parentNode.style.display = null;
                if (x && y) {
                    const xy = a.href.replace(/.*sx=(\d+)&sy=(\d+)/gi, '$1,$2');
                    const [cX, cY] = xy.split(',');
                    if (!neighbors) {
                        return +x !== +cX || +y !== +cY;
                    } else {
                        return cX < x - 1 || cY < y - 1 || cX > x + 1 || cY > y + 1;
                    }
                }
            }
            return false;
        }).forEach(a => a.parentNode.parentNode.style.display = 'none')
}

function fixUI() {
    const activeLink = document.querySelector('a[href="' + location.href + '"]');
    if (activeLink) {
        activeLink.className += ' vp-active-link';
    }

    return Array.from(document.querySelectorAll('a'))
        .filter(a => {
            if (a.href.indexOf('map.php?sx') !== -1) {
                const clearButton = document.createElement('span');
                const xy = a.href.replace(/.*sx=(\d+)&sy=(\d+)/gi, '$1,$2');
                const [x, y] = xy.split(',');
                a.innerHTML = `${a.innerHTML}[${xy}]`;
                clearButton.className = 'vp-filter';
                clearButton.innerText = 'x';
                clearButton.onclick = filterMap.bind(this, 0, 0);
                a.parentNode.appendChild(createFilterLink(x, y));
                a.parentNode.appendChild(createFilterLink(x, y, createFilterLink));
                a.parentNode.appendChild(clearButton);
            }
        })
}

async function cacheMap() {
    for (const resource of Object.keys(resInfo)) {
        let body = document.body;
        if (resource !== resourceName) {
            VPLogger.log(`request '${resource}' info...`);
            body = await VP.getHtml(`/statlist.php?r=${resource}`);
            VPLogger.log(`received '${resource}' info!`);
        }

        cache[resource] = scanForResourceInfo(body);
    }
}

function scanForResourceInfo(body) {
    const [buyersTable, sellersTable] = body.querySelectorAll('center>table table');

    return {
        buyers: cacheTable(buyersTable),
        sellers: cacheTable(sellersTable)
    };
}

function cacheTable(table) {
    const res = {};
    Array.from(table.tBodies[0].rows).slice(1).forEach((line) => {
        const [x, y] = line.cells[0].firstElementChild.href.replace(/.*\?sx=(\d+)&sy=(\d+).*/g, '$1,$2').split(',');
        const count = Number(line.cells[1].innerText);
        const price = Number(line.cells[2].innerText.replace(/\D+/i, ''));
        if (!res[`${x},${y}`]) {
            res[`${x},${y}`] = [];
        }
        const [id, name] = line.cells[0].innerHTML.replace(/.*object.php\?id=(\d+)">([^<#]+)<.*/g, '$1,$2').split(',');
        const enemy = !!line.querySelector('s');
        res[`${x},${y}`].push({
            element: line,
            price,
            count,
            object: {id, name},
            x,
            y,
            enemy
        })
    });
    return res;
}


function collectStats(withLicense) {
    const summary = {};
    const cc = JSON.parse(JSON.stringify(cache));
    for (let [resource, info] of Object.entries(cc)) {
        for (let [sector, positions] of Object.entries(info.sellers)) {
            if (!summary[sector]) {
                summary[sector] = {};
            }
            if (!summary[sector][resource]) {
                summary[sector][resource] = {};
            }
            summary[sector][resource] = collectSectorStats(
                positions,
                info.buyers[sector],
                withLicense
            );
        }
    }
    return summary;
}

function collectSectorStats(positions, buyerPositions, withLicense) {
    let summary = {
        transactions: [],
        profit: 0
    };

    if (positions.length > 0 && buyerPositions && buyerPositions.length > 0) {
        for (let {price, count, enemy, object, resourceName} of positions) {
            for (let buyerPosition of buyerPositions) {
                if (buyerPosition.count && count && buyerPosition.price > price) {
                    const licenseRequired = buyerPosition.enemy || enemy;
                    if (licenseRequired && !withLicense) {
                        continue;
                    }
                    const countToBuy = Math.min(buyerPosition.count, count);
                    count -= countToBuy;
                    buyerPosition.count -= countToBuy;
                    summary.transactions.push({
                        resourceName,
                        buy: {
                            price: price,
                            count: countToBuy,
                            object: object
                        },
                        sell: {
                            price: buyerPosition.price,
                            count: countToBuy,
                            object: buyerPosition.object
                        }
                    });
                    summary.profit += (buyerPosition.price - price) * countToBuy;
                } else {
                    break;
                }
            }
        }
    }
    return summary;
}

function getSectorClass(xy) {
    let classList = 'vp-cell-inner';
    if (currentSector === xy) {
        classList += ' vp-current-sector';
    } else if (neighborSectors.includes(xy)) {
        classList += ' vp-neighbor-sector';
    }
    if (portSectors.includes(xy)) {
        classList += ' vp-port-sector';
    }

    return classList;
}

function createMapCellContent(x, y) {
    const container = document.createElement('div');
    const filterLink = createFilterLink(x, y);
    const xy = `${x},${y}`;
    const sectorSummary = summary[xy];
    const sectorSummaryWithLicense = summaryWithLicense[xy];
    let profit = 0;
    let profitWithLicense = 0;

    const content = document.createElement('div');
    container.className = getSectorClass(xy);
    container.innerHTML = `<span class="vp-small">[${xy}]</span>`;
    container.appendChild(filterLink);
    let detailedInfo = '';

    for(const [resource, rInfo] of Object.entries(sectorSummary)) {
        const currentResourceProfit = rInfo.profit;
        const currentResourceProfitWithLicense = sectorSummaryWithLicense[resource].profit;
        const additional = currentResourceProfitWithLicense - currentResourceProfit;
        profit += currentResourceProfit;
        profitWithLicense += currentResourceProfitWithLicense;

        if (currentResourceProfit > 0 || additional) {
            detailedInfo += `<div class="vp-detailed-info-line">${resource}: ${rInfo.profit} ${additional ? `(+${additional})` : ''}</div>`;
        }
    }

    content.innerHTML = `${profit}`;
    if (profit !== profitWithLicense) {
        content.innerHTML += `<span class="vp-small">(+${profitWithLicense - profit})</span>`;
    }
    content.innerHTML += `<div class="vp-detailed-info">${detailedInfo}</div>`;

    content.className = `vp-center ${profit ? 'vp-has-profit' : ''}`;
    container.appendChild(content);
    return container;
}

function addMap() {
    let table = document.createElement('table');
    for (let y = 47; y < 54; y++) {
        const line = table.insertRow();
        for (let x = 47; x < 54; x++) {
            const cell = line.insertCell();
            cell.append(createMapCellContent(x, y));
        }
    }
    const container = document.createElement('div');
    container.className = 'vp-map-table';
    container.appendChild(table);
    document.querySelector('.gw-container>center').prepend(container);
}

function createFilterLink(x, y, neighbors) {
    const button = document.createElement('span');
    button.innerText = neighbors ? '☄' : `⚙`;
    button.className = 'vp-filter';
    button.onclick = () => {
        filterMap(x, y, neighbors);
    };
    return button;
}

function findCurrentSector() {
    Array.from(document.querySelectorAll('td>a[style]')).forEach(link => {
        const xy = link.href.replace(/.*sx=(\d+)&sy=(\d+)/gi, '$1,$2');
        if (xy) {
            if (link.style.color === currentSectorColor) {
                currentSector = xy;
            } else if (link.style.color === neighborSectorColor) {
                neighborSectors.push(xy);
            }
        }
    });
}

function showTransactions() {
    const container = document.createElement('div');
    container.className = 'vp-transaction-section';
    container.innerHTML = '<div class="greenbg"><h3>Transactions</h3></div>';
    const activeSectorInfo = summary[currentSector];

    if (activeSectorInfo) {
        for (const [resource, info] of Object.entries(activeSectorInfo)) {
            const activeSectorTransactions = info.transactions || [];
            if (activeSectorTransactions.length) {
                const subHeader = document.createElement('div');
                subHeader.className = 'vp-subheader';
                subHeader.innerHTML = `<b>${resource}</b>`;
                container.appendChild(subHeader);
                for (let i = 0; i < activeSectorTransactions.length; i++) {
                    const transaction = activeSectorTransactions[i];
                    const transactionEl = createTransactionComponent(transaction, resource);
                    transactionEl.className += i % 2 ? ' greengreenbg' : ' greenlightbg';
                    container.appendChild(transactionEl);
                }
            }
        }
    }
    document.querySelector('.gw-container>center').prepend(container);
}

function createTransactionComponent(transaction, resource) {
    const transactionContainer = document.createElement('div');
    transactionContainer.className = 'vp-transaction-section--item';
    let totalBuy = transaction.buy.count;
    while (totalBuy > 0) {
        const buyPerIteration = Math.min(totalBuy, maxWeightLimit / resInfo[resource]);
        totalBuy -= buyPerIteration;
        const fullCycleButton = createFullCycleButton(transaction, buyPerIteration, resource);
        const buyLine = document.createElement('div');
        buyLine.className = 'vp-buy-line';
        buyLine.innerHTML = `Buy: <b>${buyPerIteration}</b> in <a target="_blank" href="/object.php?id=${transaction.buy.object.id}">${transaction.buy.object.name}</a>`;

        let statusEl = createStatusElement(++transactionID);
        transactionStatusEls[transactionID] = statusEl;
        buyLine.append(createBuyButton(transaction.buy.object.id, buyPerIteration, resource, transactionID), statusEl);

        const sellLine = document.createElement('div');
        sellLine.className = 'vp-sell-line';
        sellLine.innerHTML = `Sell: <b>${buyPerIteration}</b> in <a target="_blank" href="/object.php?id=${transaction.sell.object.id}">${transaction.sell.object.name}</a>`;

        statusEl = createStatusElement(++transactionID);
        transactionStatusEls[transactionID] = statusEl;
        sellLine.append(createSellButton(transaction.sell.object.id, buyPerIteration, resource, transactionID), statusEl);

        transactionContainer.append(fullCycleButton, buyLine, sellLine);
    }

    return transactionContainer;
}

function createFullCycleButton(transaction, amount, type) {
    const div = document.createElement('div');
    div.className = 'vp-buy-line';
    const button = document.createElement('button');
    let statusEl = createStatusElement(++transactionID);
    button.type = 'button';
    button.innerText = 'Buy + Sell';
    button.onclick = () => doFullTransaction(transaction.buy.object.id, transaction.sell.object.id, amount, type, transactionID);
    div.append(button, statusEl);
    return div;
}

function doFullTransaction(fromObjectId, toObjectId, amount, type, id) {
    // 1. Fetch objects
    // 2. Check amounts
    // 3. Buy -> sell
}

function createStatusElement(id) {
    const el = document.createElement('div');
    el.className = 'vp-status-line';
    el.setAttribute('transaction-id', id);
    return el;
}

function createBuyButton(objectId, count, type, id) {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerText = 'Buy';
    button.onclick = () => doBuyTransaction(objectId, count, type, id);
    return button;
}

function createSellButton(objectId, count, type, id) {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerText = 'Sell';
    button.onclick = () => doSellTransaction(objectId, count, type, id);
    return button;
}

async function doBuyTransaction(objectId, count, type, id) {
    const formValues = await VP.getFormTransaction(objectId, type);
    console.log(formValues);
    if (formValues.amount < count) {
        alert('amount has changed. abort');
        return;
    }
    formValues.amount = count;
    return doObjectTransferRequest(formValues, id);
}

async function doSellTransaction(objectId, count, type, id) {
    VPLogger.log(`try to sell <b>${count}</b> ${type} to <a href="/object.php?id=${objectId}">#${objectId}</a>`);

    const formValues = await VP.getFormTransaction(objectId, type);
    console.log(formValues);

    formValues.amount = count;
    return doObjectTransferRequest(formValues, id);
}

async function doObjectTransferRequest(formValues, id) {
    const postResponseBody = await VP.postDataHtml('object-transfers.php', formValues);
    const messageContainer = postResponseBody.querySelector('table[align=center] td');
    if (messageContainer) {
        const statusText = messageContainer.innerText;
        if (!statusText.includes('Вы успешно')) {
            // TODO: add captcha case here
            transactionStatusEls[id].innerHTML = `<span class="vp-error">Error: </span>`;
        }
        transactionStatusEls[id].innerHTML += messageContainer.innerHTML;
    }
    VPLogger.log(transactionStatusEls[id].innerHTML);
}

(async function() {
    if (location.href.indexOf('/statlist.php') !== -1) {
        // get current sector
        findCurrentSector();
        VPLogger.log(`Defined Crrent sector: <b>${currentSector}</b>`);
        await cacheMap();
        summary = collectStats();
        VPLogger.log(`Collected stats without license`);
        summaryWithLicense = collectStats(true);
        VPLogger.log(`Collected stats with license`);
        showTransactions();
        VPLogger.log(`Transaction list rendered`);
        addMap();
        VPLogger.log(`Map rendered`);
        fixUI();
        VPLogger.log(`Added UI fixes to the statlist`);
    }

})();
