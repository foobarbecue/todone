startTimer = function () {
    // always running, adding time to the item that's in progress
    timerId = setInterval(
        function(){
            var item_in_progress=Session.get('in_progress_item');
            if (!!item_in_progress){
            Todos.update(item_in_progress._id, {$inc: {total_time: 1}});
            // TODO couldn't find a mongodb way of setting the last
            // item so I have to remove and replace it :-p
            Todos.update(item_in_progress._id,{$pop: {stop_times: 1}});
            var now = Date.now();
            Todos.update(item_in_progress._id,{$push: {stop_times: now}})
            }
        },
        1000
    );
}

stopTimer = function(){
    clearInterval(timerId);
}

startTimer();