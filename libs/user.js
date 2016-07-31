var LEVEL_UP_VALUE = 10;
var User = function()
{
    this.lastUpdated = new Date();
    this.totalReqs = 0;
    this.level = 0;
};

User.prototype.touch = function()
{
    this.lastUpdated = new Date();
};

User.prototype.reqIncr = function()
{
    this.totalReqs++;
    if( this.meetLevelUp() ){
    	this.level++;
    }
};

User.prototype.getLevel = function()
{
	return this.level;
}

User.prototype.meetLevelUp = function()
{
    if( this.totalReqs % LEVEL_UP_VALUE === (LEVEL_UP_VALUE - 1)){
        return true;
    }
    return false;
};

User.prototype.setQuestions = function(questions)
{
    this.questions = questions;
    this.createAnswersList();
};

User.prototype.createAnswersList = function()
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
};

User.prototype.turnOnReview = function(){
    this.reviewOn = true;
};

module.exports = User;
