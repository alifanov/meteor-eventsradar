var Sources = new Meteor.Collection('sources');
var Posts = new Meteor.Collection('debug_posts');

var today_exp = /(сегодня)/mgi;
var tom_exp = /(завтра)/mgi;
var date_exp = /(^|\s)([1-9]\d?\s(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря))/mgi;
var months = {
    'января': 0,
    'февраля':1,
    'марта': 2,
    'апреля': 3,
    'мая': 4,
    'июня': 5,
    'июля': 6,
    'августа': 7,
    'сентября': 7,
    'октября': 9,
    'ноября': 10,
    'декабря': 11
};

function getGroups(user){
    var vk = user.services.vk;
    HTTP.get('https://api.vk.com/method/groups.get?uid=' +vk.id+'&extended=1&access_token='+vk.accessToken, function(err, res)
    {
        if(res.data.response){
            var d = res.data.response.slice(1);
            for(i in d)
            {
                var doc = {
                    user: vk.id,
                    source_id: -d[i].gid,
                    name: d[i].name
                };
                Sources.update(doc, doc, {upsert: true});
            }
        }
    });
}

function getFriends(user){
    var vk = user.services.vk;
    HTTP.get('https://api.vk.com/method/friends.get?uid=' +vk.id+'&fields=first_name,last_name', function(err, res)
    {
        for(i in res.data.response)
        {
            var doc = {
                user: vk.id,
                source_id: res.data.response[i].user_id,
                name: res.data.response[i].first_name + ' ' + res.data.response[i].last_name
            };
            Sources.update(doc, doc, {upsert: true});
        }
    });
}

function getPosts(user){
    var vk = user.services.vk;
    var sources = Sources.find({user:vk.id}).fetch();
    for(var k in sources)
    {
        HTTP.get('https://api.vk.com/method/wall.get?owner_id='+sources[k].source_id+'&count=10',
            function(err, res){
                if (res.data.response){
                    var d = res.data.response.slice(1);
                    for(var i in d)
                    {
                        if(d[i] && d[i].text)
                        {
                            var source = Sources.findOne({source_id: d[i].to_id});
                            var date = new Date(d[i].date*1000);
                            var now = new Date();
                            var tomorrow = new Date(now.getTime() + 24*60*60*1000);
                            if(d[i].text.match(today_exp))
                            {
                                if(date.toDateString() == now.toDateString()){
                                    var doc = {
                                        user: user.services.vk.id,
                                        date: date,
                                        text: d[i].text,
                                        source: source.name,
                                        link: 'https://vk.com/wall'+d[i].to_id+'_'+d[i].id
                                    };
                                    Posts.update(doc, doc, {upsert: true});
                                }
                            }
                            else
                            {
                                if(d[i].text.match(tom_exp))
                                {
//                                    console.log('Matched tomorrow (%s, %s)', date.toDateString(),
//                                        tomorrow.toDateString());
                                    if(date.toDateString() == tomorrow.toDateString()){
                                        var doc_tm = {
                                            user: Meteor.user().services.vk.id,
                                            date: tomorrow,
                                            text: d[i].text,
                                            source: source.name,
                                            link: 'https://vk.com/wall'+d[i].to_id+'_'+d[i].id
                                        };
//                                        console.log('Adding tomorrow');
                                        Posts.update(doc_tm, doc_tm, {upsert: true});
                                    }
                                }
                                else
                                {
                                    if(d[i].text.match(date_exp))
                                    {
//                                        console.log('Matched date');
                                        var dat = d[i].text.match(date_exp)[0]
                                            .replace(/^\s/, '')
                                            .replace(/\s$/, '')
                                            .split(' ');
                                        var dd = new Date(now.getFullYear(), months[dat[1]], dat[0]);
                                        if(dd >= now)
                                        {
                                            var doc_date = {
                                                user: user.services.vk.id,
                                                date: dd,
                                                text: d[i].text,
                                                source: source.name,
                                                link: 'https://vk.com/wall'+d[i].to_id+'_'+d[i].id
                                            };
//                                            console.log('Adding date');
                                            Posts.update(doc_date, doc_date, {upsert: true});
                                        }
                                    }
                                }
                            }
                        }

                    }
                }
            });
    }
}

var getNewPosts = function()
{
    Meteor.users.find().forEach(function(user){
        getGroups(user);
        getFriends(user);
        getPosts(user);
    });
};

var delOldPosts = function()
{
    var now = new Date();
    now = new Date(now.setHours(0, 0, 0,0));
    Posts.remove({date: {$lt: now}});
};

var cron = new Meteor.Cron({
    events: {
        "0 0 * * *": delOldPosts,
        "0 * * * *": getNewPosts
    }
});

if (Meteor.isServer) {
    Meteor.methods({
        getPosts: function ()
        {
            getFriends(Meteor.user());
            getGroups(Meteor.user());
            getPosts(Meteor.user());
        },
        getGroups: function()
        {
            getGroups(Meteor.user());
        },
        getFriends: function()
        {
            getFriends(Meteor.user());
        },
        getNewPosts: function()
        {
            getNewPosts();
        }
    });

    Meteor.startup(function () {
        Meteor.call('getNewPosts');
//        Sources.remove({});
//        Posts.remove({});
        console.log('Sources: '+Sources.find().count());
        console.log('Posts: '+Posts.find().count());

//        var posts = Posts.find().fetch();
//        for(i in posts){
//            console.log(posts[i].date);
//        }

        // code to run on server at startup
        Accounts.loginServiceConfiguration.remove({
            service: 'vk'
        });

        Accounts.loginServiceConfiguration.insert({
            service: 'vk',
            appId:   '4149541',      // Your app id
            secret:  'pPGdZM2rVbNySaTBfooe' // Your app secret
        });
    });
}
