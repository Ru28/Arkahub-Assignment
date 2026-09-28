'use strict';
const fs = require('node:fs');

const requiredAttributes = ["event_id", "order_id", "task", "status"];
const enumStatuses = new Set(["pending", "done"]);
const enumTasks = ["payment", "site_survey", "materials"];

function isPlainObject(value){
    return value!==null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value){
    return typeof value === "string" && value.trim() !== ''; // if empty return false;
}

function isValidRevision(value){
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}


function rejectionReason(update, orderIdMap){
    if(!isPlainObject(update)) return "invalid_update";

    for(const attribute of requiredAttributes){
        if(!isNonEmptyString(update[attribute])){
            return "invalid_update";
        }
    }
    
    if(!enumStatuses.has(update.status)){
        return "invalid_update";
    }

    if(!isValidRevision(update.revision)){
        return "invalid_update";
    }

    if(!orderIdMap.has(update.order_id)){
        return "unknown_order";
    }

    if(!enumTasks.includes(update.task)){
        return "unknown_task";
    }

    return null;
}

function compareAscii(a, b){
    if(a < b){
        return -1;
    }
    if(a > b){
        return 1;
    }
    return 0;
}

function buildReport(data){
    const orderIdMap = new Map();
    for(const order of data.orders){
        orderIdMap.set(order.order_id,order);
    }

    const taskStatusMap = new Map();
    for(const orderId of orderIdMap.keys()){
        taskStatusMap.set(orderId, new Map());
    }

    const seenEventIds = new Set();
    const rejectedUpdates = [];
    let duplicateUpdates = 0;

    data.updates.forEach((update, index)=>{
        const reason = rejectionReason(update, orderIdMap);
        if(reason !== null){
            const eventId = (isPlainObject(update) && isNonEmptyString(update.event_id)) ? update.event_id : null;
            rejectedUpdates.push({index, event_id:eventId, reason});
            return;
        }
        if(seenEventIds.has(update.event_id)){
            duplicateUpdates +=1;
            return;
        }

        seenEventIds.add(update.event_id);

        const tasks = taskStatusMap.get(update.order_id);
        const current = tasks.get(update.task);
        if(current === undefined || update.revision > current.revision){
            tasks.set(update.task, {revision: update.revision,status: update.status});
        }
    });

    const orders = [...orderIdMap.values()]
        .sort((a,b)=> compareAscii(a.order_id, b.order_id))
        .map((order)=>{
            const tasks= taskStatusMap.get(order.order_id);
            const pendingTasks = enumTasks.filter((task)=> tasks.get(task)?.status !== "done" );
            return {
                order_id : order.order_id,
                city: order.city,
                status: pendingTasks.length===0 ? "ready": "blocked",
                completed_tasks: enumTasks.length - pendingTasks.length,
                pending_tasks: pendingTasks
            }
        });

    const ready = orders.filter((order)=> order.status === "ready").length;

    return {
        orders,
        summary: { total_orders: orders.length, ready, blocked: orders.length-ready},
        duplicate_updates: duplicateUpdates,
        rejected_updates: rejectedUpdates
    }
}

if(require.main === module){
    if(process.argv.length!==3){
        console.error('Usage: node report.js input.json > actual.json');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
    process.stdout.write(JSON.stringify(buildReport(data),null,2)+'\n');
}

module.exports = {buildReport}