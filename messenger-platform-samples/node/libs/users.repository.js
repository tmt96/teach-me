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

module.exports = UsersRepository;