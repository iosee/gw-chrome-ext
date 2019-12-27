let cache = {};
let summary = {};
let currentSector = '';
let neighborSectors = [];
let neighborSectorColor = 'rgb(237, 124, 2)';
let currentSectorColor = 'rgb(255, 4, 4)';
let portSectors = ['52,50', '50,47', '53,53', '49,53', '47,52', '47,49'];

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

function cacheMap() {
    const [buyersTable, sellersTable] = document.querySelectorAll('center>table table');

    cache = {
        buyers: cacheTable(buyersTable),
        sellers: cacheTable(sellersTable)
    };
}

function cacheTable(table) {
    const res = {};
    Array.from(table.tBodies[0].rows).slice(1).forEach((line) => {
        const [x, y] = line.cells[0].firstElementChild.href.replace(/.*?sx=(\d+)&sy=(\d+).*/g, '$1,$2').split(',');
        const count = Number(line.cells[1].innerText);
        const price = Number(line.cells[2].innerText.replace(/\D+/i, ''));
        if (!res[`${x},${y}`]) {
            res[`${x},${y}`] = [];
        }
        const enemy = !!line.querySelector('s');
        res[`${x},${y}`].push({
            element: line,
            price,
            count,
            x,
            y,
            enemy
        })
    });
    return res;
}


function collectStats() {
    for (let [sector, positions] of Object.entries(cache.sellers)) {
        if (!summary[sector]) {
            summary[sector] = {
                transactions: [],
                profit: 0,
                profitWithLicense: 0
            };
        }
        const buyerPositions = cache.buyers[sector];
        if (positions.length > 0 && buyerPositions && buyerPositions.length > 0) {
            for (let {price, count, enemy} of positions) {
                for (let buyerPosition of buyerPositions) {
                    if (buyerPosition.count && count && buyerPosition.price > price) {
                        // Buy position
                        const countToBuy = Math.min(buyerPosition.count, count);
                        const licenseRequired = buyerPosition.enemy || enemy;
                        count -= countToBuy;
                        buyerPosition.count -= countToBuy;
                        summary[sector].transactions.push({
                            buy: countToBuy,
                            buyPrice: price,
                            sellPrice: buyerPosition.price,
                            licenseRequired
                        });
                        if (!licenseRequired) {
                            summary[sector].profit += (buyerPosition.price - price) * countToBuy;
                        }
                        summary[sector].profitWithLicense += (buyerPosition.price - price) * countToBuy;
                    } else {
                        break;
                    }
                }
            }
        }
    }
}

function getSectorClass(xy) {
    let classList = '';
    if (currentSector === xy) {
        classList = ' vp-current-sector';
    } else if (neighborSectors.includes(xy)) {
        classList = ' vp-neighbor-sector';
    }
    if (portSectors.includes(xy)) {
        classList += ' vp-port-sector';
    }

    return classList;
}

function addMap() {
    let table = document.createElement('table');
    for (let y = 47; y < 54; y++) {
        const line = table.insertRow();
        for (let x = 47; x < 54; x++) {
            const xy = `${x},${y}`;
            const info = summary[xy];
            const profit = info ? info.profit : 0;
            const profitWithLicense = info ? info.profitWithLicense : 0;
            const cell = line.insertCell();
            const filterLink = createFilterLink(x,y);
            const content = document.createElement('div');

            cell.className = getSectorClass(xy);
            cell.innerHTML = `<span class="vp-small">[${xy}]</span>`;
            content.className = `vp-center ${profit ? 'vp-has-profit' : ''}`;
            content.innerHTML = `${profit}`;
            if (profit !== profitWithLicense) {
                content.innerHTML += `<div class="vp-small">(+${profitWithLicense - profit})</div>`;
            }

            cell.appendChild(filterLink);
            cell.appendChild(content);
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

if (location.href.indexOf('/statlist.php') !== -1) {
    // get current sector
    findCurrentSector();
    console.log(`current sector: ${currentSector}`);
    cacheMap();

    collectStats();
    console.log(`Summary: `, summary);
    addMap();
    fixUI();
}
