var User = require('./user');
var UsersRepository = {
    dictUsers : {},
    get : function(id)
    {
        if( !this.dictUsers[id] ){
            this.dictUsers[id] = new User();
        }
        this.dictUsers[id].touch();
        return this.dictUsers[id] ;
    }
};

User.prototype.setQuestions = function(questions)
{
    this.questions = questions;
    this.createAnswersList();
};

User.protoptype.createAnswersList = function()
{
    var arrAnswers = [];
    for (var i=0; i < this.questions.length; i++) {
        console.log(i, this.questions[i].translated);
        arrAnswers[i] = this.questions[i].translated;
    }
    this.arrAnswers = arrAnswers;
};

User.prototype.getAnswerList = function() {
    return this.arrAnswers;
}

User.prototype.getAQuestionAndRemoveOutOfStack = function()
{
    if( !this.questions.length ){
        return null;
    }
    var question = this.questions.shift();
    this.originalWord = question.word;
    this.correctAnswer = question.translated;
    return question;
};

User.prototype.turnOffReview = function()
{
  this.reviewOn = false;
  this.arrAnswers = [];
  this.questions = [];
  this.originalWord = '';
  this.correctAnswer = '';
}

User.prototype.turnOnReview = function(){
    this.reviewOn = true;
}

module.exports = UsersRepository;