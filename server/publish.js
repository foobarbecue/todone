// Todos -- {text: String,
//           done: Boolean,
//           tags: [String, ...],
//           created_by: String,
//           timestamp: Number}
Todos = new Meteor.Collection("todos");

// Publish all items for requested user.
Meteor.publish('todos', function () {
  return Todos.find({created_by: this.userId});
});

