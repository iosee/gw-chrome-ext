
function createArrow(text, directions) {
    const buttonElement = document.createElement('button');
    buttonElement.type = 'button';
    buttonElement.innerText = text;
    buttonElement.onclick = async () => {
        await VPMove(directions);
    };
    return buttonElement;
}


function renderNavigation() {
    const div = document.createElement('div');
    div.className = 'vp-floating-navigation';
    div.innerHTML = '<div id="navigation-status"></div>';

    const divTop = document.createElement('div');
    divTop.append(
        createArrow('↖', {
            top: true,
            left: true
        }),
        createArrow('↑', {
            top: true
        }),
        createArrow('↗', {
            top: true,
            right: true
        }),
    );

    const divMid = document.createElement('div');
    divMid.append(
        createArrow('←', {
            left: true
        }),
        createArrow('→', {
            right: true
        })
    );

    const divBot = document.createElement('div');
    divBot.append(
        createArrow('↙', {
            bottom: true,
            left: true
        }),
        createArrow('↓', {
            bottom: true
        }),
        createArrow('↘', {
            bottom: true,
            right: true
        }),
    );

    div.append(divTop, divMid, divBot, createAutoMovingElement());
    document.body.appendChild(div);
}

function createAutoMovingElement() {
    const div = document.createElement('div');
    div.innerHTML = 'Auto run enabled ';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isAutoRunEnabled();
    checkbox.onchange = () => {
        localStorage.setItem('vp-auto-run', checkbox.checked ? 'true' : '');
        if (checkbox.checked) {
            setCollectedInfoByAutoRun({
                started: Date.now(),
                profit: 0,
                finished: '',
                sectorsVisited: 0
            })
        }
    };
    div.append(checkbox, document.createElement('br'));

    div.append('Stay in current sector');
    const stayInCurrentSectorCheckbox = document.createElement('input');
    stayInCurrentSectorCheckbox.type = 'checkbox';
    stayInCurrentSectorCheckbox.checked = isStayInEnabled();
    stayInCurrentSectorCheckbox.onchange = () => {
        localStorage.setItem('vp-stay-in', stayInCurrentSectorCheckbox.checked ? 'true' : '');
    };
    div.append(stayInCurrentSectorCheckbox);

    const collectedInfo = getCollectedInfoByAutoRun();
    const collectedInfoEl = document.createElement('div');
    const nextMove = getNextMove();
    collectedInfoEl.className = 'vp-collected-info';
    collectedInfoEl.innerHTML = `
    <table>
        <tr><td>Collected</td><td><b>${collectedInfo.profit}</b> Gb</td></tr>
        <tr><td>Visited sectors</td><td>${collectedInfo.sectorsVisited}</td></tr>
        <tr><td>Started</td><td>${collectedInfo.started ? new Date(collectedInfo.started).toTimeString().split(' ')[0] : ''}</td></tr> 
        <tr><td>Finished</td><td>${collectedInfo.finished}</td></tr>
        <tr><td>Next</td><td>${nextMove ? JSON.stringify(Object.keys(nextMove)) : 'none'}</td></tr>
    </table>`;
    div.appendChild(collectedInfoEl);

    return div;
}

function getCollectedInfoByAutoRun() {
    const info = localStorage.getItem('vp-auto-run-info');
    if (info) {
        return JSON.parse(info);
    } else {
        return {};
    }
}

function setCollectedInfoByAutoRun(updates) {
    const currentInfo = getCollectedInfoByAutoRun();
    localStorage.setItem('vp-auto-run-info', JSON.stringify({
        ...currentInfo,
        ...updates
    }));
}

function isStayInEnabled() {
    return !!localStorage.getItem('vp-stay-in');
}
function isAutoRunEnabled() {
    return !!localStorage.getItem('vp-auto-run');
}

function getNextMove() {
    const movement = {};
    if (currentSectorCords && neighborMaxProfitCords) {
        if (currentSectorCords.x < neighborMaxProfitCords.x) {
            movement.right = 1;
        } else if (currentSectorCords.x > neighborMaxProfitCords.x) {
            movement.left = 1;
        }
        if (currentSectorCords.y < neighborMaxProfitCords.y) {
            movement.bottom = 1;
        } else if (currentSectorCords.y > neighborMaxProfitCords.y) {
            movement.top = 1;
        }
        return movement;
    }
}

async function VPMove({ top, bottom, left, right }) {
    const data = {};
    if (top) {
        data['moveup'] = 1;
    } else if (bottom) {
        data['movedown'] = 1;
    }
    if (right) {
        data['moveright'] = 1;
    } else if (left) {
        data['moveleft'] = 1;
    }
    const movingInfo = await VP.postDataHtml('/map.move.php', data);
    const time = Number(movingInfo.querySelector('#mmdiv').innerText);

    document.getElementById('navigation-status').innerHTML = `Moving: <b>${time}</b> sec left`;

    await VP.asyncTimeout((time + 1) * 1000);

    const res = await VP.postDataHtml('/map.php', data);
    const selectedSector = res.querySelector('[name="sxy"] option[selected]');

    if (selectedSector) {
        document.getElementById('navigation-status').innerHTML = `Moved to <b>${selectedSector.innerText}</b>`;
        window.location.reload();
    } else {
        throw `Something went wrong....`;
    }
}
