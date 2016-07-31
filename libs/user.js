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


module.exports = User;
