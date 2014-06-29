// Client-side JavaScript, bundled and sent to client.

// Define Minimongo collections to match server/publish.js.
Todos = new Meteor.Collection("todos");

// ID of currently selected list
Session.setDefault('list_id', null);

// Name of currently selected tag for filtering
Session.setDefault('tag_filter', null);

// When adding tag to a todo, ID of the todo
Session.setDefault('editing_addtag', null);

// When editing a list name, ID of the list
Session.setDefault('editing_listname', null);

// When editing todo text, ID of the todo
Session.setDefault('editing_itemname', null);

var todosHandle = null;
// Always be subscribed to the todos for the selected user.
Deps.autorun(function () {
  var userId = Meteor.userId();
  if (typeof userId !== 'undefined')
    todosHandle = Meteor.subscribe('todos');
  else
    todosHandle = null;
});


////////// Helpers for in-place editing //////////

// Returns an event map that handles the "escape" and "return" keys and
// "blur" events on a text input (given by selector) and interprets them
// as "ok" or "cancel".
var okCancelEvents = function (selector, callbacks) {
  var ok = callbacks.ok || function () {};
  var cancel = callbacks.cancel || function () {};

  var events = {};
  events['keyup '+selector+', keydown '+selector+', focusout '+selector] =
    function (evt) {
      if (evt.type === "keydown" && evt.which === 27) {
        // escape = cancel
        cancel.call(this, evt);

      } else if (evt.type === "keyup" && evt.which === 13 ||
                 evt.type === "focusout") {
        // blur/return/enter = ok/submit if non-empty
        var value = String(evt.target.value || "");
        if (value)
          ok.call(this, value, evt);
        else
          cancel.call(this, evt);
      }
    };

  return events;
};

var activateInput = function (input) {
  input.focus();
  input.select();
};

////////// Todos //////////

Template.todos.loading = function () {
  return todosHandle && !todosHandle.ready();
};

Template.todos.events(okCancelEvents(
  '#new-todo',
  {
    ok: function (text, evt) {
      var tag = Session.get('tag_filter');
      Todos.insert({
        created_by: Meteor.userId(),
        text: text,
        list_id: Session.get('list_id'),
        done: false,
        // TODO get rid of this field
        timestamp: (new Date()).getTime(),
        start_times:[],
        stop_times:[],
        tags: tag ? [tag] : []
      });
      evt.target.value = '';
    }
  }));

Template.todos.todos = function () {
  // Determine which todos to display in main pane,
  // selected based on list_id and tag_filter.

  var tag_filter = Session.get('tag_filter');
  if (tag_filter)
    return Todos.find({tags: tag_filter}, {sort: {timestamp: 1}});
  else
    return Todos.find({},{sort: {timestamp: 1}});
};

Template.todo_item.tag_objs = function () {
  var todo_id = this._id;
  return _.map(this.tags || [], function (tag) {
    return {todo_id: todo_id, tag: tag};
  });
};

Template.todo_item.done_class = function () {
  return this.done ? 'done' : '';
};

Template.todo_item.checked = function () {
  var in_progress_item = Session.get('in_progress_item');
  if (!!in_progress_item){
      if (this._id === Session.get('in_progress_item')._id){
        return 'checked'
      }
  }
};

Template.todo_item.editing = function () {
  return Session.equals('editing_itemname', this._id);
};

Template.todo_item.adding_tag = function () {
  return Session.equals('editing_addtag', this._id);
};

UI.registerHelper(
    'humanizeTime',
    function(seconds) {
        var hh = Math.floor(seconds / 3600);
        var mm = Math.floor((seconds - (hh * 3600)) / 60);
        var ss = seconds - (hh * 3600) - (mm * 60);

        if (mm < 10) {mm = '0' + mm}
        if (ss < 10) {ss = '0' + ss}
        
        if (hh > 0){
            if (hh < 10) {hh = '0' + hh}
            return hh + ':' + mm + ':' + ss;
        } else {
            return mm + ':' + ss;
        }
        
    }
   )

Template.todo_item.events({
  'click .markdone': function () {
    Todos.update(this._id, {$set: {done: !this.done, done_time: Date()}});
  },
  
  'click .markinprogress': function (event) {
        // end the previous inprogress segment
        var item_in_progress = Session.get('in_progress_item');
        if (!!item_in_progress){
            Todos.update(item_in_progress._id,{$push: {stop_times: Date.now()}});
//             $(event.currentTarget).parents('li').siblings().removeClass('inprogress');
        }

        // do this to trigger resetting zoom to extents
//         tlDrawn=false;        
        Todos.update(this._id,{$push: {start_times:Date.now()}});
//         $(event.currentTarget).parents('li').addClass('inprogress');
        Session.set('in_progress_item', this);
        
        event.currentTarget.checked = this.checked;
},

  'click .destroy': function () {
    Todos.remove(this._id);
  },

  'click .addtag': function (evt, tmpl) {
    Session.set('editing_addtag', this._id);
    Deps.flush(); // update DOM before focus
    activateInput(tmpl.find("#edittag-input"));
  },

  'dblclick .display .todo-text': function (evt, tmpl) {
    Session.set('editing_itemname', this._id);
    Deps.flush(); // update DOM before focus
    activateInput(tmpl.find("#todo-input"));
  },

  'click .remove': function (evt) {
    var tag = this.tag;
    var id = this.todo_id;

    evt.target.parentNode.style.opacity = 0;
    // wait for CSS animation to finish
    Meteor.setTimeout(function () {
      Todos.update({_id: id}, {$pull: {tags: tag}});
    }, 300);
  },
  'click #pause_button': function(evt){
      var item_in_progress = Session.get('in_progress_item');
      Todos.update(item_in_progress._id,{$push: {stop_times: Date.now()}});      
      Session.set('in_progress_item',null);
  }
  
});

Template.todo_item.events(okCancelEvents(
  '#todo-input',
  {
    ok: function (value) {
      Todos.update(this._id, {$set: {text: value}});
      Session.set('editing_itemname', null);
    },
    cancel: function () {
      Session.set('editing_itemname', null);
    }
  }));

Template.todo_item.events(okCancelEvents(
  '#edittag-input',
  {
    ok: function (value) {
      Todos.update(this._id, {$addToSet: {tags: value}});
      Session.set('editing_addtag', null);
    },
    cancel: function () {
      Session.set('editing_addtag', null);
    }
  }));

////////// Tag Filter //////////

// Pick out the unique tags from all todos in current list.
Template.tag_filter.tags = function () {
  var tag_infos = [];
  var total_count = 0;

  Todos.find({list_id: Session.get('list_id')}).forEach(function (todo) {
    _.each(todo.tags, function (tag) {
      var tag_info = _.find(tag_infos, function (x) { return x.tag === tag; });
      if (! tag_info)
        tag_infos.push({tag: tag, count: 1});
      else
        tag_info.count++;
    });
    total_count++;
  });

  tag_infos = _.sortBy(tag_infos, function (x) { return x.tag; });
  tag_infos.unshift({tag: null, count: total_count});

  return tag_infos;
};

Template.tag_filter.tag_text = function () {
  return this.tag || "All items";
};

Template.tag_filter.selected = function () {
  return Session.equals('tag_filter', this.tag) ? 'selected' : '';
};

Template.tag_filter.events({
  'mousedown .tag': function () {
    if (Session.equals('tag_filter', this.tag))
      Session.set('tag_filter', null);
    else
      Session.set('tag_filter', this.tag);
  }
});

startStopData = function(){
    var tl_items=[];
    Todos.find().forEach(function(todo_item){
        for (ind = 0; ind < todo_item.start_times.length; ind ++){
            tl_items.push(
                {
                    'start' : todo_item.start_times[ind],
                    'end' : todo_item.stop_times[ind],
                    'content' : todo_item.text
                }
            );
            
        };
        });
    return tl_items
};

tlDrawn=false;

Template.timeline.draw = function(){
    try{
//         if (typeof(timeline) == "undefined"){
            // Instantiate our timeline object.

            
            // Draw our timeline with the created data and options
            if (!tlDrawn){
                timeline = new links.Timeline(
                    document.getElementById('timeline')   
                );                
                tlDrawn=true;
                var data = startStopData();
                timeline.draw(data);
                timeline.setVisibleChartRange(Date.now(),Date.now()+60000);             
            }else{
                var data = startStopData();
                timeline.draw(data);
            }
    }
    catch(TypeError){
        console.log('Tried to load timeline before DOM ready, failed.');
        tlDrawn=false;
        
    }
}

////////// Accounts //////////

Accounts.ui.config({ passwordSignupFields: 'USERNAME_AND_OPTIONAL_EMAIL' });