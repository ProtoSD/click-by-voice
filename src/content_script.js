//
// Requesting background script to perform actions on our behalf
//

function act(action, arguments) {
    arguments.action = action;
    chrome.runtime.sendMessage(arguments);
}



//
// Labeling elements with hint tags
//

var next_CBV_hint      = 0;  // -1 means hints are off
var hinting_parameters = ""; // extra argument to :+ if any

// Enumerate each element that we should hint, possibly more than once:
function each_hintable(callback) {
    inner_callback = function(element) {
	var usable = true;
	if (element.css("display") == "none")
	    usable = false;
	if (element.attr("aria-hidden") == "true")
	    usable = false;

	if (usable)
	    callback(element);
    };


    // <<<>>>
    if (hinting_parameters.indexOf("II") != -1) {
	$("div").each(function(index) {
	    if ($(this).css("background-image") != "none" &&
		$(this).parent().css("background-image") == "none")
		inner_callback($(this));
	});
    }


    // experiment: just a particular element kind:
    var kind = "";
    if (hinting_parameters.indexOf("I") != -1)
	kind = "img";
    else if (hinting_parameters.indexOf("S") != -1)
	kind = "span";
    else if (hinting_parameters.indexOf("D") != -1)
	kind = "div";
    else if (hinting_parameters.indexOf("L") != -1)
	kind = "li";
    else if (hinting_parameters.indexOf("R") != -1)
	kind = "[role]";
    if (kind != "") {
	console.log("hinting: " + kind);
	$(kind).each(function(index) {
	    inner_callback($(this));
	});
	return;
    }


    //
    // Standard clickable or focusable HTML elements
    //

    // Quora has placeholder links with click handlers...
    //$("a[href]").each(function(index) {
    $("a").each(function(index) {
	inner_callback($(this));
    });

    $("button").each(function(index) {
	inner_callback($(this));
    });

    $("input").each(function(index) {
	var input_type = $(this).attr("type");
	if (input_type)
	    input_type = input_type.toLowerCase();
	var usable = true;
	if (input_type == "hidden") 
	    usable = false;
	if ($(this).attr("disabled") == "true")
	    usable = false;

	if (usable)
	    inner_callback($(this));
    });

    $("select").each(function(index) {
	inner_callback($(this));
    });

    $("keygen").each(function(index) {
	inner_callback($(this));
    });


    //
    // non-Standard HTML elements directly made clickable or focusable
    //

    $("[onclick]").each(function(index) {
	inner_callback($(this));
    });

    $("[tabindex]").each(function(index) {
	if ($(this).attr("tabindex") != "-1")
	    inner_callback($(this));
    });


    //
    // non-Standard HTML elements that might be clickable due to event
    // listeners
    //

    $("[role]").each(function(index) {
	var role = $(this).attr("role");
	switch (role) {
	case "button":
	case "checkbox":
	case "link":
	case "menuitem":
	case "menuitemcheckbox":
	case "menuitemradio":
	case "option":
	case "radio":
	case "slider":
	case "tab":
	case "textbox":
	case "treeitem":
	    inner_callback($(this));
	    break;
	}
    });
}


function remove_hints() {
    //console.log("removing hints");

    $("[CBV_hint_number]").removeAttr("CBV_hint_number");
    $("[CBV_hint_tag]").remove();

    next_CBV_hint = -1;
}


function add_hints() {
    console.log("adding hints: " + hinting_parameters);

    if (next_CBV_hint < 0)
	next_CBV_hint = 0;

    each_hintable(function(element) {
	if (!element.is("[CBV_hint_number]")) {
	    element.attr("CBV_hint_number", next_CBV_hint);

	    var span = "<span CBV_hint_tag='" + next_CBV_hint + "'></span>";
	    if (hinting_parameters.indexOf("c") != -1)
		span = "<span CBV_hint_tag='" + next_CBV_hint + "' CBV_high_contrast='true'></span>";

	    var put_inside = false;
	    if (element.is("a") || element.is("button"))
		put_inside = true;
	    if (hinting_parameters.indexOf("i") != -1 
		&& (element.children().length>0
	            || element.text != ""))
		put_inside = true;

	    if (put_inside && hinting_parameters.indexOf("ii") != -1) {
		// first check is to ensure no text or comment direct subnodes
		if (element.contents().length == 1
		    && element.contents().first().is("div, span")) {
		    console.log(">> " + element.text());
		    element = element.children().first();
	    	}
	    }

	    if (put_inside) {
		if (hinting_parameters.indexOf("b") != -1)
		    element.prepend(span);
		else
		    element.append(span);
	    } else {
		if (hinting_parameters.indexOf("b") != -1)
		    element.before(span);
		else
		    element.after(span);
	    }
	    next_CBV_hint = next_CBV_hint + 1;
	}
    });

    //console.log("total hints assigned: " + next_CBV_hint);
}

function refresh_hints() {
    //console.log(document.activeElement);
    if (next_CBV_hint >= 0)
	add_hints();
}



//
// Activating a hint by number
//

// apply heuristics to determine if an element should be clicked or
// focused
function wants_click(element) {
    if (element.is("button")) {
	return true;
    } else if (element.is("a")) {
	return true;
    } else if (element.is(":input")) {
	if (element.attr("type") == "submit")
	    return true;
	if (element.attr("type") == "checkbox")
	    return true;
	if (element.attr("type") == "radio")
	    return true;
	if (element.attr("type") == "button")
	    return true;
    }
    if (element.attr("onclick")) {
	return true;
    }
    var role = element.attr("role");
    switch (role) {
    case "button":
    case "link":
	return true;
	break;
    }

    return false;
}

function dispatch_mouse_events(element, event_names) {
    event_names.forEach(function(event_name) {
	var event = document.createEvent('MouseEvents');
	event.initMouseEvent(event_name, true, true, window, 1, 0, 0, 0, 0, 
			     false, false, false, false, 0, null);
	element[0].dispatchEvent(event);
    });
}

var last_hover = null;

function activate(element, operation) {
    element.addClass("CBV_highlight_class");
    setTimeout(function() {
	// sometimes elements get cloned so do this globally...
	$(".CBV_highlight_class").removeClass("CBV_highlight_class");
    }, 500);

    setTimeout(function() {
	switch (operation) {
	case "f":
	    if (last_hover) {
		dispatch_mouse_events(last_hover, ['mouseout', 'mouseleave']);	    
	    }
	    // focus same element twice => do nothing (except unhover above):
	    if (last_hover==null || last_hover[0] !== element[0]) {
		element[0].focus();
		dispatch_mouse_events(element, ['mouseover', 'mouseenter']);	    
		last_hover = element;
	    } else
		last_hover = null;
	    break;

	case "c":
	    dispatch_mouse_events(element, ['mouseover', 'mousedown', 'mouseup', 
					    'click']);
	    break;
	case "t":
	    if (element.attr("href"))
		act("create_tab", {URL: element[0].href, active: true});
	    break;
	case "b":
	    if (element.attr("href"))
		act("create_tab", {URL: element[0].href, active: false});
	    break;
	case "w":
	    if (element.attr("href"))
		act("create_window", {URL: element[0].href});
	    break;

	    // old versions for comparison purposes; depreciated
	case "C":
	    element[0].click();
	    break;
	case "CC":
	    dispatch_mouse_events(element, ['mouseover', 'mousedown']);
	    element[0].focus();
	    dispatch_mouse_events(element, ['mouseup', 'click']);
	    break;
	case "DC":
	    if (element.children().length>0)
		 element = element.children().first();
	    element[0].click();
	    break;


	case "F":
	    element[0].focus();
	    break;
	case "FF":
	    element[0].focusin();
	    element[0].focus();
	    break;

	    // experimental:
	case "R":
	    dispatch_mouse_events(element, ['mouseover', 'contextmenu']);
	    break;

	default:
	    console.log("unknown activate operation: " + operation);
	}
    }, 250);
}

function goto_hint(hint, operation) {
    var element = $("[CBV_hint_number='" + hint + "']");
    if (element.length == 0) {
	console.log("goto_hint: unable to find hint: " + hint);
	return;
    }

    if (operation == "") {
	if (wants_click(element))
	    operation = "c";
	else
	    operation = "f";
	//console.log("defaulting to: " + operation);
    }

    activate(element, operation);
}



//
// Main routine
//

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
	var operation = request.operation;
	if (operation.startsWith("+")) {
	    remove_hints();
	    hinting_parameters = operation.substr(1);
	    add_hints();
	} else if (operation == "-") {
	    remove_hints();
	} else {
	    goto_hint(request.hint_number, operation);
	}
    });

$(document).ready(function() {
    add_hints();
    //setTimeout(function() { add_hints(); }, 5000);
    // This runs even when our tab is in the background:
    setInterval(refresh_hints, 3000);
});
