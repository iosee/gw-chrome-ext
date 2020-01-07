let cache = {};
let summary = {};
let summaryWithLicense = {};
let currentSector = '';
let currentSectorCords;
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
const maxWeightLimit = 170;
const errorLabelEl = '<span class="vp-error">Error: </span>';
const transactions = [];
let restartEnabled = true;
let GO_BUTTON;
let neighborMaxProfit = 0;
let neighborMaxProfitCords;
let VPNextMove;
let error = false;
function getMaxWeightLimit() {
    const el = document.getElementById('maxWeightLimit');
    if (el && el.value) {
        return el.value;
    } else {
        return maxWeightLimit;
    }
}

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
        const linkHref = line.cells[0].firstElementChild.href;
        if (!linkHref) {
            return;
        }
        const [x, y] = linkHref.replace(/.*\?sx=(\d+)&sy=(\d+).*/g, '$1,$2').split(',');
        const count = Number(line.cells[1].innerText);
        const price = Number(line.cells[2].innerText.replace(/\D+/i, ''));
        if (!res[`${x},${y}`]) {
            res[`${x},${y}`] = [];
        }
        const [id, name] = line.cells[0].innerHTML.replace(/.*object.php\?id=(\d+)">([^#][^<]+)<.*/g, '$1,$2').split(',');
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

    for (const [resource, rInfo] of Object.entries(sectorSummary)) {
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

    if (neighborSectors.includes(xy)) {
        if (neighborMaxProfit < profit) {
            neighborMaxProfitCords = { x, y };
            neighborMaxProfit = profit;
        }
    }

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
        const [x, y] = xy.split(',').map(Number);
        if (xy) {
            if (link.style.color === currentSectorColor) {
                currentSector = xy;
                currentSectorCords = {x, y};
            } else if (link.style.color === neighborSectorColor) {
                neighborSectors.push(xy);
            }
        }
    });
}

function showTransactions() {
    const container = document.createElement('div');
    container.className = 'vp-transaction-section';
    container.innerHTML = `<div class="greenbg"><h3>Transactions</h3></div>`;
    container.appendChild(createDoAllTransactionsButton());
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

function createDoAllTransactionsButton() {
    const div = document.createElement('div');
    div.innerHTML += `maxWeightLimit: <input id="maxWeightLimit" value="${maxWeightLimit}">`;

    GO_BUTTON = document.createElement('button');
    GO_BUTTON.type = 'button';
    GO_BUTTON.innerText = ' Do it!';
    GO_BUTTON.onclick = doFullCycle;
    div.appendChild(GO_BUTTON);
    return div;
}

async function doFullCycle() {
    GO_BUTTON.disabled = true;
    transactions.sort((a, b) => b.profit - a.profit);
    console.log('Doing next: ', transactions);
    let totalProfit = 0;
    for (const transaction of transactions) {
        const index = transactions.indexOf(transaction);
        if (transaction.done) {
            continue;
        }
        try {
            const success = await doFullTransaction(
                transaction.fromObject.id,
                transaction.toObject.id,
                transaction.amount,
                transaction.resource,
                transaction.id
            );
            if (success) {
                transaction.done = true;
                totalProfit += transaction.profit;
            }
            document.title = `${ Math.round((index + 1) * 100 / transactions.length ) } % ::: +${totalProfit}`;
        } catch (e) {
            error = true;
            break;
        }
        await VP.asyncTimeout(Math.round(2000 + Math.random() * 3000));
    }
    GO_BUTTON.disabled = false;
    document.title = '100% :::: Done :::: ';

    const collectedInfo = getCollectedInfoByAutoRun();
    setCollectedInfoByAutoRun({
        profit: (collectedInfo.profit || 0) + totalProfit,
        sectorsVisited: (collectedInfo.sectorsVisited || 0) + 1
    });
    VPLogger.log(`<span class="vp-success-message">Done! Collected ${totalProfit} Gb</span>`);
}

function createTransactionComponent(transaction, resource) {
    const transactionContainer = document.createElement('div');
    transactionContainer.className = 'vp-transaction-section--item';
    let totalBuy = transaction.buy.count;
    while (totalBuy > 0) {
        const buyPerIteration = Math.min(totalBuy, getMaxWeightLimit() / resInfo[resource]);
        const iterationProfit = buyPerIteration * (transaction.sell.price - transaction.buy.price);
        totalBuy -= buyPerIteration;
        transactionID++;
        let statusEl = createStatusElement(transactionID);
        const fullCycleButton = createFullCycleButton(transaction, buyPerIteration, resource, transactionID);
        transactions.push({
            fromObject: {
                ...transaction.buy.object
            },
            toObject: {
                ...transaction.sell.object
            },
            amount: buyPerIteration,
            profit: iterationProfit,
            resource,
            id: transactionID
        });

        const line = document.createElement('div');
        line.className = 'vp-buy-line';
        line.innerHTML = `
            <b>+${iterationProfit}Gb</b> 
            (${buyPerIteration}, <a target="_blank" href="/object.php?id=${transaction.buy.object.id}">${transaction.buy.object.name}</a>
            &raquo; <a target="_blank" href="/object.php?id=${transaction.sell.object.id}">${transaction.sell.object.name}</a>)
        `;
        line.append(fullCycleButton, statusEl);
        transactionContainer.append(line);
    }

    return transactionContainer;
}

function createFullCycleButton(transaction, amount, type, transactionID) {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerText = '⤪';
    button.onclick = async () => {
        button.disabled = true;
        restartEnabled = false;
        await doFullTransaction(transaction.buy.object.id, transaction.sell.object.id, amount, type, transactionID);
        button.disabled = false;
        restartEnabled = true;
    };
    return button;
}

async function doFullTransaction(fromObjectId, toObjectId, amount, type, id) {
    // 1. Fetch objects
    const fromObjectInfo = await VP.getFormTransaction(fromObjectId, type);
    if (typeof fromObjectInfo === 'string') {
        VPLogger.log(`<div>${errorLabelEl}: ${fromObjectInfo}</div>`, id);
        error = true;
        return false;
    }
    if (fromObjectInfo.availableAmount < amount) {
        VPLogger.log(`Object can't sell <b>${amount}</b> ${type}. Available: <b>${fromObjectInfo.availableAmount}</b>`, id);
        return false;
    }

    const toObjectInfo = await VP.getFormTransaction(toObjectId, type);
    if (typeof toObjectInfo === 'string') {
        VPLogger.log(`<div>${errorLabelEl}: ${toObjectInfo}</div>`, id);
        error = true;
        return false;
    }
    if (toObjectInfo.canBuy < amount) {
        VPLogger.log(`Object can't buy <b>${amount}</b> ${type}. Can buy: <b>${toObjectInfo.canBuy}</b>`, id);
        return false;
    }

    // Buy
    VPLogger.log(`buying <b>${amount}</b> ${type} in <a href="/object.php?id=${fromObjectId}">#${fromObjectId}</a>`, id);
    await doObjectTransferRequest({
        ...fromObjectInfo.formValues,
        amount
    }, id);

    // Sell
    VPLogger.log(`wait 2 sec and selling <b>${amount}</b> ${type} to <a href="/object.php?id=${toObjectId}">#${toObjectId}</a>`, id);
    await VP.asyncTimeout(1500);
    await doObjectTransferRequest({
        ...toObjectInfo.formValues,
        amount
    }, id);
    return true;
}

function createStatusElement(id) {
    const el = document.createElement('div');
    el.className = 'vp-status-line';
    el.setAttribute('transaction-id', id);
    transactionStatusEls[id] = el;
    return el;
}

async function doBuyTransaction(objectId, amount, type, id) {
    const fromObjectInfo = await VP.getFormTransaction(objectId, type);

    if (typeof fromObjectInfo === 'string') {
        VPLogger.log(`<div>${errorLabelEl}: ${fromObjectInfo}</div>`, id);
        return false;
    }
    if (fromObjectInfo.formValues.amount < amount) {
        VPLogger.log('amount has changed. abort', id);
        return false;
    }
    return doObjectTransferRequest({
        ...fromObjectInfo.formValues,
        amount
    }, id);
}

async function doSellTransaction(objectId, amount, type, id) {
    VPLogger.log(`try to sell <b>${amount}</b> ${type} to <a href="/object.php?id=${objectId}">#${objectId}</a>`, id);

    const toObjectInfo = await VP.getFormTransaction(objectId, type);

    if (typeof toObjectInfo === 'string') {
        VPLogger.log(`<div>${errorLabelEl}: ${toObjectInfo}</div>`, id);
        return;
    }
    return doObjectTransferRequest({
        ...toObjectInfo.formValues,
        amount
    }, id);
}

async function doObjectTransferRequest(formValues, id) {
    let message = '';
    const postResponseBody = await VP.postDataHtml('object-transfers.php', formValues);
    const messageContainer = postResponseBody.querySelector('table[align=center] td');
    if (messageContainer) {
        const statusText = messageContainer.innerText;
        if (!statusText.includes('Вы успешно')) {
            // TODO: add captcha case here
            message += errorLabelEl + messageContainer.innerHTML;
            VPLogger.log(message, id);
            throw message;
        }
        message += `<div>${messageContainer.innerHTML}</div>`;
    } else {
        message += `${errorLabelEl}${postResponseBody.innerHTML}`;
    }
    VPLogger.log(message, id);
}

async function autoRun() {
    await doFullCycle();

    if (isAutoRunEnabled() && !error) {
        if (isStayInEnabled()) {
            await VP.asyncTimeout(50000);
            if (isAutoRunEnabled() && isStayInEnabled()) {
                window.location.reload();
            }
        } else {
            const nextMove = getNextMove();
            if (nextMove) {
                if (neighborMaxProfit < 1000) {
                    await  VP.asyncTimeout(10000);
                }
                await VPMove(nextMove);
            }
        }
    }
}

(async function () {
    if (location.href.indexOf('/statlist.php') !== -1) {
        // get current sector
        findCurrentSector();
        VPLogger.log(`Defined current sector: <b>${currentSector}</b>`);
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
        renderNavigation();

        if (isAutoRunEnabled()) {
            await autoRun();
        }
    }

})();
