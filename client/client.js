(function($) {

    // Matches trailing non-space characters.
    var chop = /(\s*\S+|\s)$/;

    // Return a truncated html string.  Delegates to $.fn.truncate.
    $.truncate = function(html, options) {
        return $('<div></div>').append(html).truncate(options).html();
    };

    // Truncate the contents of an element in place.
    $.fn.truncate = function(options) {
        if ($.isNumeric(options)) options = {length: options};
        var o = $.extend({}, $.truncate.defaults, options);

        return this.each(function() {
            var self = $(this);

            if (o.noBreaks) self.find('br').replaceWith(' ');

            var text = self.text();
            var excess = text.length - o.length;

            if (o.stripTags) self.text(text);

            // Chop off any partial words if appropriate.
            if (o.words && excess > 0) {
                excess = text.length - text.slice(0, o.length).replace(chop, '').length - 1;
            }

            if (excess < 0 || !excess && !o.truncated) return;

            // Iterate over each child node in reverse, removing excess text.
            $.each(self.contents().get().reverse(), function(i, el) {
                var $el = $(el);
                var text = $el.text();
                var length = text.length;

                // If the text is longer than the excess, remove the node and continue.
                if (length <= excess) {
                    o.truncated = true;
                    excess -= length;
                    $el.remove();
                    return;
                }

                // Remove the excess text and append the ellipsis.
                if (el.nodeType === 3) {
                    $(el.splitText(length - excess - 1)).replaceWith(o.ellipsis);
                    return false;
                }

                // Recursively truncate child nodes.
                $el.truncate($.extend(o, {length: length - excess}));
                return false;
            });
        });
    };

    $.truncate.defaults = {

        // Strip all html elements, leaving only plain text.
        stripTags: false,

        // Only truncate at word boundaries.
        words: false,

        // Replace instances of <br> with a single space.
        noBreaks: false,

        // The maximum length of the truncated html.
        length: Infinity,

        // The character to use as the ellipsis.  The word joiner (U+2060) can be
        // used to prevent a hanging ellipsis, but displays incorrectly in Chrome
        // on Windows 7.
        // http://code.google.com/p/chromium/issues/detail?id=68323
        ellipsis: '\u2026' // '\u2060\u2026'

    };

})(jQuery);


Sources = new Meteor.Collection('sources');
Posts = new Meteor.Collection('debug_posts');

var DateFormats = {
    short: "DD MMMM - YYYY",
    long: "dddd DD.MM.YYYY HH:mm",
    simple: "DD-MM-YYYY"
};

function eliminateDuplicates(arr) {
    var i,
        len=arr.length,
        out=[],
        obj={};

    for (i=0;i<len;i++) {
        obj[arr[i]]=0;
    }
    for (i in obj) {
        out.push(i);
    }
    return out;
}

now = new Date();
now = new Date(now.getFullYear(), now.getMonth(), now.getDate());
today = new Date(now.getTime()+24*60*60*1000);
tomorrow = new Date(now.getTime()+2*24*60*60*1000);
week = new Date(now.getTime()+7*24*60*60*1000);
month = new Date(now.getTime()+30*24*60*60*1000);

console.log(today);

var getFilter = function() {
    if (Session.equals("filter", undefined)) {
        return {};
    }
    return Session.get("filter")
};

Template.home.filter = function() { return getFilter(); };

filter = {};

Handlebars.registerHelper("formatDate", function(datetime, format) {
    if (moment) {
        f = DateFormats[format];
        return moment(datetime).format(f);
    }
    else {
        return datetime;
    }
});


if (Meteor.isClient) {

    Meteor.Router.add({
        '/': function(){
            if(Meteor.user()){
                return 'home';
            }
            else{
                return 'greet';
            }
        },
        '/about/': 'about',
        '/contacts/': 'contacts',
        '*': '404'
    });

    if(Meteor.user())
    {
        filter = {
            user: Meteor.user().services.vk.id,
            date: {$lte: today}
        }
    }
    Template.home.posts = function(){
        if (Meteor.user()){
            return Posts.find(getFilter(), {sort: {date:1}}).fetch();
        }
        return [];
    };

    Template.menu.user = function()
    {
        return Meteor.user();
    };

    Template.home.rendered = function(){
        $(".panel-body").truncate({
            length: 200,
            words: true
        });
        var date_arr = [];
        $(".panel").each(function(i, v){
            var cl = $(v).attr('class');
            cl = cl.split(' ')[2];
            date_arr.push(cl);
        });
        date_arr = eliminateDuplicates(date_arr);
        $.each(date_arr, function(i, v){
            $('.'+v).wrapAll('<div class="group-date group-' + v+'"></div>');
            $(".group-"+v).prepend('<div class="slide-group"><a href="#">'+ v.split('date-')[1] +'</a></div><hr />');
        });
        $(".slide-group a").toggle(function(){
            $(this).parents('.group-date').eq(0).find('.panel').fadeOut(600);
        }, function(){
            $(this).closest('.group-date').eq(0).find('.panel').fadeIn(600);
        });
    };

    Template.home.events({
        'click .today': function(e,t){
            filter.date = {$lt: today};
            Session.set('filter', filter);
            e.preventDefault();
        },
        'click .tomorrow': function(e,t){
            filter.date = {$gte: today, $lt: tomorrow};
            Session.set('filter', filter);
            e.preventDefault();
        },
        'click .week': function(e,t){
            filter.date = {$lte: week};
            Session.set('filter', filter);
            e.preventDefault();
        },
        'click .month': function(e,t){
            filter.date = {$lte: month};
            Session.set('filter', filter);
            e.preventDefault();
        },
        'click button.process-posts': function(){
        Meteor.call('getPosts');
        }
    });

    Template.menu.events({
        'click .auth' : function (e,t) {
            Meteor.loginWithVk({}, function()
            {
                Meteor.call('getPosts');
            });
            e.preventDefault();
        }
    });
    Template.greet.events({
        'click .auth' : function (e,t) {
            Meteor.loginWithVk({}, function()
            {
                Meteor.call('getPosts');
            });
            e.preventDefault();
        }
    });


}