
define(['jquery', 'storage'], function ($, Storage) {

    var App = Class.extend({
        init: function () {

            const urlParams = new URLSearchParams(window.location.search);
            const sessionId = urlParams.get('sessionId');
            if (sessionId === null || sessionId === undefined) {
                alert("No session id provided. Please go to the NFT picker page and select an NFT to play with.");
            }
            this.currentPage = 1;
            this.blinkInterval = null;
            this.previousState = null;
            this.isParchmentReady = true;
            this.ready = false;
            this.storage = new Storage(sessionId);
            this.sessionId = sessionId;
            this.watchNameInputInterval = setInterval(this.toggleButton.bind(this), 100);
            this.$playButton = $('.play');
            this.$playDiv = $('.play div');
            this.settings = new GameSettings(this);
        },

        setGame: function (game) {
            this.game = game;
            this.isMobile = this.game.renderer.mobile;
            this.isTablet = this.game.renderer.tablet;
            this.isDesktop = !(this.isMobile || this.isTablet);
            this.supportsWorkers = !!window.Worker;
            this.ready = true;
            this.game.sessionId = this.sessionId;
        },

        center: function () {
            window.scrollTo(0, 1);
        },

        canStartGame: function () {
            if (this.isDesktop) {
                return (this.game && this.game.map && this.game.map.isLoaded);
            } else {
                return this.game;
            }
        },

        tryStartingGame: function (username, mapId, starting_callback) {
            var self = this,
                $play = this.$playButton;

            if (username !== '') {
                if (!this.ready || !this.canStartGame()) {
                    if (!this.isMobile) {
                        // on desktop and tablets, add a spinner to the play button
                        $play.addClass('loading');
                    }
                    this.$playDiv.unbind('click');
                    var watchCanStart = setInterval(function () {
                        console.debug("waiting...");
                        if (self.canStartGame()) {
                            setTimeout(function () {
                                if (!self.isMobile) {
                                    $play.removeClass('loading');
                                }
                            }, 1500);
                            clearInterval(watchCanStart);
                            self.startGame(username, mapId, starting_callback);
                        }
                    }, 100);
                } else {
                    this.$playDiv.unbind('click');
                    this.startGame(username, mapId, starting_callback);
                }
            }
        },

        startGame: function (username, mapId, starting_callback) {
            var self = this;

            if (starting_callback) {
                starting_callback();
            }
            this.hideIntro(function () {
                if (!self.isDesktop) {
                    // On mobile and tablet we load the map after the player has clicked
                    // on the PLAY button instead of loading it in a web worker.
                    self.game.loadMap(mapId);
                }
                self.start(username);
            });
        },

        start: function (username) {
            var self = this,
                firstTimePlaying = !self.storage.hasAlreadyPlayed();

            if (username && !this.game.started) {
                var optionsSet = false,
                    config = this.config;

                //>>includeStart("devHost", pragmas.devHost);
                if (config.local) {
                    console.debug("Starting game with local dev config.");
                    this.game.setServerOptions(config.local.host, config.local.port, username, config.dev.protocol);
                } else {
                    console.debug("Starting game with default dev config.");
                    this.game.setServerOptions(config.dev.host, config.dev.port, username, config.dev.protocol);
                }
                optionsSet = true;
                //>>includeEnd("devHost");

                //>>includeStart("prodHost", pragmas.prodHost);
                if (!optionsSet) {
                    console.debug("Starting game with build config.");
                    this.game.setServerOptions(config.build.host, config.build.port, username, config.build.protocol);
                }
                //>>includeEnd("prodHost");

                this.center();
                this.game.run(function () {
                    $('body').addClass('started');
                    if (firstTimePlaying) {
                        self.toggleInstructions();
                    }
                });
            }
        },

        setMouseCoordinates: function (event) {
            var gamePos = $('#container').offset(),
                width = this.game.renderer.getWidth(),
                height = this.game.renderer.getHeight(),
                mouse = this.game.mouse;

            var scale;

            if(this.settings.getFullscreen()) {
                scale = $('#container').css("transform").split("(")[1].split(")")[0].split(",");
                mouse.x = (event.pageX - gamePos.left) / parseFloat(scale[0])
                mouse.y = (event.pageY - gamePos.top) / parseFloat(scale[3])
            } else {
                scale = this.game.renderer.getScaleFactor();
                mouse.x = event.pageX - gamePos.left - (this.isMobile ? 0 : 5 * scale);
                mouse.y = event.pageY - gamePos.top - (this.isMobile ? 0 : 7 * scale);
            }

            if (mouse.x <= 0) {
                mouse.x = 0;
            } else if (mouse.x >= width) {
                mouse.x = width - 1;
            }

            if (mouse.y <= 0) {
                mouse.y = 0;
            } else if (mouse.y >= height) {
                mouse.y = height - 1;
            }
        },

        initHealthBar: function () {
            var scale = this.game.renderer.getScaleFactor(),
                healthMaxWidth = $("#healthbar").width() - (12 * scale);

            this.game.onPlayerHealthChange(function (hp, maxHp) {
                var barWidth = Math.round((healthMaxWidth / maxHp) * (hp > 0 ? hp : 0));
                $("#hitpoints").css('width', barWidth + "px");
            });

            this.game.onPlayerHurt(this.blinkHealthBar.bind(this));
        },

        blinkHealthBar: function () {
            var $hitpoints = $('#hitpoints');

            $hitpoints.addClass('white');
            setTimeout(function () {
                $hitpoints.removeClass('white');
            }, 500)
        },

        toggleButton: function () {
            var name = $('#parchment input').val(),
                $play = $('#createcharacter .play');

            if (name && name.length > 0) {
                $play.removeClass('disabled');
                $('#character').removeClass('disabled');
            } else {
                $play.addClass('disabled');
                $('#character').addClass('disabled');
            }
        },

        hideIntro: function (hidden_callback) {
            clearInterval(this.watchNameInputInterval);
            $('body').removeClass('intro');
            setTimeout(function () {
                $('body').addClass('game');
                hidden_callback();
            }, 1000);
        },

        showChat: function () {
            if (this.game.started) {
                $('#chatbox').addClass('active');
                $('#chatinput').show().focus();
                $('#chatbutton').addClass('active');
                self = this;
                axios.get("/chat").then(function (response) {
                    if (response.data === undefined) {
                        return;
                    }
                    self.game.destroyBubble("global");
                    if (response.data) {
                        chatHTML = "<div>";
                        response.data.forEach(function (message) {

                            date = new Date(message.epoch);
                            time = date.toLocaleTimeString();
                            chatHTML += `<p><b>${message.playerName}</b>&nbsp;[${time}]:&nbsp;${message.message}</p>`
                        });
                        chatHTML += "</div>";
                        self.game.createBubble("global", chatHTML);
                    }
                });
            }
        },

        hideChat: function () {
            if (this.game.started) {
                $('#chatbox').removeClass('active');
                $('#chatinput').blur();
                $('#chatbutton').removeClass('active');
                this.game.destroyBubble("global");

                $('#emoteMenu').removeClass('active');
                $('#emoteMenu').children().each(function(index) {
                    $(this).delay(($('#emoteMenu').children().length - index) * 20).fadeOut(100);
                });
            }
        },


        toggleInstructions: function () {
            if ($('#achievements').hasClass('active')) {
                this.toggleAchievements();
                $('#achievementsbutton').removeClass('active');
            }
            $('#instructions').toggleClass('active');
        },

        toggleAchievements: function () {
            if ($('#instructions').hasClass('active')) {
                this.toggleInstructions();
                $('#inventorybutton').removeClass('active');
            }

            if ($('body').hasClass('inventory')) {
                this.hideInventory();
            }
            if($('body').hasClass('settings')) {
                this.closeSettings();
            }

            this.resetPage();
            $('#achievements').toggleClass('active');
            if ($('#achievements').hasClass('active')) {
                this.currentPage = 1;
                this.game.initAchievements()
            }
        },

        showNewQuestPopup(quest) {
            let newQuestPopup = $('#new-achievement-popup');
            newQuestPopup.find('#new-achievement-name').text(quest.name);

            let questText = quest.longText ?? (_.isArray(quest.startText) ? quest.startText.join("<br/>") : quest.startText)
            newQuestPopup.find('#new-achievement-text').html(questText);
            let eventTypeText = "";
            if(quest.type === "KILL_MOB") {
                eventTypeText = "Kill ";
            }
            else if(quest.type === "LOOT_ITEM") {
                eventTypeText = "Loot ";
            }

            newQuestPopup.removeClass("hidden");
        },

        resetPage: function () {
            var self = this,
                $achievements = $('#achievements');

            if ($achievements.hasClass('active')) {
                $achievements.bind(TRANSITIONEND, function () {
                    $('#lists').css({left: 0});
                    self.currentPage = 1;
                    $achievements.unbind(TRANSITIONEND);
                });
            }
        },

        initEquipmentIcons: function () {
            var scale = this.game.renderer.getScaleFactor();
            var getIconPath = function (spriteName) {
                    return 'img/' + scale + '/item-' + spriteName + '.png';
                },
                weapon = this.game.player.getWeaponName(),
                armor = this.game.player.getSpriteName(),
                weaponPath = getIconPath(weapon),
                armorPath = 'img/3/' + armor + '.png';

            $('#weapon').css('background-image', 'url("' + weaponPath + '")');
            if (armor !== 'firefox') {
                if (scale === 2) {
                    $('#armor').css('background-image', 'url("' + armorPath + '")').css('object-fit', 'cover').css('background-position', '-4px -311px');
                } else if (scale === 3) {
                    $("#armor").css('background-image', 'url("' + armorPath + '")').css('background-position', '-4px -408px');
                }
            }
        },

        hideWindows: function () {
            if ($('#achievements').hasClass('active')) {
                this.toggleAchievements();
                $('#achievementsbutton').removeClass('active');
            }
            if ($('#instructions').hasClass('active')) {
                this.toggleInstructions();
                $('#inventorybutton').removeClass('active');
            }
            if ($('body').hasClass('credits')) {
                this.closeInGameCredits();
            }
            if ($('body').hasClass('inventory')) {
                this.hideInventory();
            }
            if ($('body').hasClass('settings')) {
                this.closeSettings();
            }

            $('#new-achievement-popup').addClass('hidden')
            $('#shop-popup').addClass('hidden')
            $('#shop-confirmation').removeClass('visible').addClass('hidden');
        },

        showAchievementNotification: function (questName, endText, xpReward, medal) {
            var $notif = $('#achievement-notification'),
                $name = $notif.find('.name'),
                $button = $('#achievementsbutton');

            $notif.removeClass().addClass('active achievement' + medal);
            $name.text(questName);

            if (this.game.storage.getAchievementCount() === 1) {
                this.blinkInterval = setInterval(function () {
                    $button.toggleClass('blink');
                }, 500);
            }
            setTimeout(function () {
                $notif.removeClass('active');
                $button.removeClass('blink');
            }, 5000);
        },

        displayUnlockedAchievement: function (id) {
            var $achievement = $('#achievements li.achievement' + id);

            var achievement = this.game.getAchievementById(id);
            if (achievement && achievement.hidden) {
                this.setAchievementData($achievement, achievement.name, achievement.desc);
            }
            $achievement.addClass('unlocked');
        },

        unlockAchievement: function (questName, endText, xpReward, medal) {
            this.showAchievementNotification(questName, endText, xpReward, medal);
        },

        initAchievementList: function (achievements) {
            var self = this,
                $lists = $('#lists'),
                $page = $('#page-tmpl'),
                $achievement = $('#achievement-tmpl'),
                page = 0,
                count = 0,
                $p = null;

            $('#achievements #lists').text('');

            let reversed_achievements = Object.values(achievements).reverse()
            _.each(reversed_achievements, function (achievement) {
                count++;

                var $a = $achievement.clone();
                $a.removeAttr('id');
                $a.addClass('achievement' + achievement.medal);
                $a.addClass('panelBorder');
                $a.click(function() {
                    $a.closest('ul').addClass('hidden');
                    self.openAchievement(achievement)
                })

                if (achievement.status === 'COMPLETED') {
                    $a.addClass('unlocked');
                }
                if (!achievement.hidden) {
                    if (achievement.progressCount !== undefined && achievement.amount !== undefined) {
                        achievement.name = achievement.progressCount + "/" + achievement.amount + " " + achievement.name;
                    }
                    self.setAchievementData($a, achievement.name, achievement.desc);
                }
                $a.show();

                if ((count - 1) % 4 === 0) {
                    page++;
                    $p = $page.clone();
                    $p.attr('id', 'page' + page);
                    $p.show();
                    $lists.append($p);
                }

                $p.append($a);
            });

            let totalAchievements = $('#achievements').find('li').length;
            $('#total-achievements').text(totalAchievements);
            if (totalAchievements <= 4) {
                $('#achievements #previous').hide();
                $('#achievements #next').hide();
            } else {
                $('#achievements #previous').show();
                $('#achievements #next').show();
            }

            $('#close-achievement-details').click(function() {
                $('#achievement-details').addClass('hidden');
                $('#achievements #lists ul').removeClass('hidden');
            });

            $('#close-new-achievement').click(function(e) {
                $('#new-achievement-popup').addClass('hidden');
                e.preventDefault();
                e.stopImmediatePropagation();
            });
        },

        initUnlockedAchievements: function (ids) {
            var self = this;

            _.each(ids, function (id) {
                self.displayUnlockedAchievement(id);
            });
            $('#unlocked-achievements').text(ids.length);
        },

        openAchievement: function (achievement) {
            let details = $('#achievement-details');

            details.find('#achievement-details-name').text(achievement.name);

            let questText = achievement.longDesc ?? achievement.desc;
            if(_.isArray(questText)) {
                questText = questText.join("<br/>");
            }
            details.find('#achievement-details-text').html(questText);
            if (achievement.status === 'COMPLETED') {
                details.find('#achievement-details-status').text(achievement.status);
            } else {
                details.find('#achievement-details-status').text(achievement.progressCount + "/" + achievement.amount);
            }
            details.find('#achievement-details-level-number').text(achievement.level);

            let eventTypeText = "";
            if(achievement.type === "KILL_MOB") {
                eventTypeText = "Kill ";
            }
            else if(achievement.type === "LOOT_ITEM") {
                eventTypeText = "Loot ";
            }
            details.find('#achievement-details-objective-type').text(eventTypeText);
            details.find('#achievement-details-objective-amount').text(achievement.amount);
            details.find('#achievement-details-objective-target').text(achievement.targetName);

            details.removeClass('achievement1');
            details.removeClass('achievement2');
            details.removeClass('achievement3');
            details.removeClass('achievement4');
            details.removeClass('achievement5');
            details.removeClass('achievement6');
            details.removeClass('achievement7');
            details.removeClass('achievement8');
            details.removeClass('achievement9');
            details.removeClass('achievement10');
            details.removeClass('achievement11');
            details.removeClass('achievement12');
            details.removeClass('achievement13');
            details.removeClass('achievement14');
            details.removeClass('achievement15');
            details.removeClass('achievement16');
            details.removeClass('achievement17');
            details.removeClass('achievement18');
            details.removeClass('achievement19');
            details.removeClass('achievement20');

            details.addClass('achievement' + achievement.medal);
            if (achievement.status === 'COMPLETED') {
                details.addClass('unlocked');
            }

            details.removeClass('hidden');
        },

        setAchievementData: function ($el, name, desc) {
            $el.find('.achievement-name').html(name);

            if(_.isArray(desc)) {
                desc = desc.join(" ");
            }
            $el.find('.achievement-description').html(desc);
            $el.find('.achievement-description').attr('title', desc);
        },

        toggleCredits: function () {
            $('body').removeClass('death');
            var currentState = $('#parchment').attr('class');

            if (this.game.started) {
                $('#parchment').removeClass().addClass('credits');

                $('body').toggleClass('credits');
                /*
                if(!this.game.player) {
                    $('body').toggleClass('death');
                }
                */
                if ($('body').hasClass('inventory')) {
                    this.hideInventory();
                    $('#inventorybutton').removeClass('active');
                }
            } else {
                if (currentState !== 'animate') {
                    if (currentState === 'credits') {
                        this.animateParchment(currentState, this.previousState);
                    } else {
                        this.animateParchment(currentState, 'credits');
                        this.previousState = currentState;
                    }
                }
            }
        },

        isInventoryVisible: false,

        toggleInventory: function () {
            if (this.isInventoryVisible) {
                this.hideInventory();
            } else {
                this.showInventory();
            }
        },

        showInventory: function () {
            _this = this;

            let inventoryQuery = "/session/" + _this.storage.sessionId + "/inventory";
            let weaponInventory = [],
                specialInventory = [],
                consumablesInventory = {};

            axios.get(inventoryQuery).then(function(response) {
                if (response.data){
                    weaponInventory = response.data.inventory;
                    specialInventory = response.data.special;
                    consumablesInventory = response.data.consumables;
                    botsInventory = response.data.bots;
                }  
                let inventoryHtml = "";
                let columns = 0;

                inventoryHtml += "<div class='inventorySection' id='inventory-weapons'><div class='inventoryTitle'>Weapons</div>";
                inventoryHtml += "<div class='inventorySectionItems'>"
                if (weaponInventory.length > 0) {
                    columns++;
                    weaponInventory.forEach(function(item) {
                        imgTag = "<div class='item panelBorder'>" +
                            "<div class='tooltiptext pixel-corners-xs'><span class='tooltipHighlight'>Level " + item.level + "</span> " + item.weaponName + " (" + item.Trait + ")</div>" +
                            "<img id='" + item.nftId + "' style='width: 32px; height: 32px; object-fit: cover; cursor: pointer; object-position: 100% 0;' src='img/3/item-" + item.nftId + ".png' />" +
                            "</div>";
                        inventoryHtml += imgTag;
                    });
                }
                inventoryHtml += "</div></div>";

                if (specialInventory.length > 0) {
                    columns++;
                    inventoryHtml += "<div class='inventorySection' id='inventory-tools'><div class='inventoryTitle'>Tools</div>";
                    inventoryHtml += "<div class='inventorySectionItems'>"

                    specialInventory.forEach(function(item) {
                        imgTag = "<div class='item panelBorder'>" +
                            "<div class='tooltiptext pixel-corners-xs'><span class='tooltipHighlight'>Level " + item.level + "</span> " + item.specialItemName + " (" + item.Trait + ")</div>" +
                            "<img id='" + item.nftId + "' style='width: 32px; height: 32px; object-fit: cover; cursor: pointer; object-position: 100% 0;' src='img/3/item-" + item.nftId + ".png' /></div>";
                        inventoryHtml += imgTag;
                    });
                    inventoryHtml += "</div></div>";
                }


                if (Object.keys(consumablesInventory).length > 0) {
                    let itemHtml = "<div class='inventorySection' id='inventory-tools'><div class='inventoryTitle'>Items</div>";
                    itemHtml += "<div class='inventorySectionItems'>"
                    let hasItem = false;
                    Object.keys(consumablesInventory).forEach(item => {
                        if (Types.isResource(item)) {
                            return;
                        }
                        hasItem = true;

                        let description = consumablesInventory[item].description;
                        let tooltipText = "";
                        if (description){
                            tooltipText = "<div class='tooltiptext pixel-corners-xs'>" + description + "</div>";
                        }

                        let cursor = consumablesInventory[item].consumable ? "pointer" : "not-allowed";
                        itemHtml += "<div class='item panelBorder'>" + tooltipText + "<img id='" + item + "' style='width: 32px; height: 32px; object-fit: cover; object-position: 100% 0; cursor: " + cursor + ";' src='img/3/" + consumablesInventory[item].image + ".png' />";
                        itemHtml += "<p id='count_" + item + "'>" + consumablesInventory[item].qty + "</p>"
                        itemHtml += "</div>";
                    });

                    itemHtml += "</div></div>";

                    if (hasItem) {
                        columns++;
                        inventoryHtml += itemHtml;
                    }
                }

                if (botsInventory.length > 0) {
                    columns++;
                    inventoryHtml += "<div class='inventorySection' id='inventory-companions'><div class='inventoryTitle'>Companions</div>";
                    inventoryHtml += "<div class='inventorySectionItems'>"

                    botsInventory.forEach(function(bot) {
                        if (bot) {
                            imgTag = `<div class='item panelBorder'><div class='tooltiptext pixel-corners-xs'><span class='tooltipHighlight'>Level ${bot.level}</span> ${bot.looperName}</div><img id=${bot.nftId} style='width: 32px; height: 32px; object-fit: cover; cursor: pointer; object-position: 100% 0;' src='img/1/` + bot.nftId + ".png' /></div>";
                            inventoryHtml += imgTag;
                        }
                    });
                    inventoryHtml += "</div></div>";
                }

                $("#inventorycontent").html(inventoryHtml);
                $('#inventorybutton').addClass('active');
                $("#inventorycontent").addClass("columns" + columns);
                let equipFunc = function (item) {
                    if (document.getElementById(item) !== null) {
                        let equip = function (e) {
                            let itemId = Types.getKindFromString(item);
                            let nftId = item.replace("NFT_", "0x");
                            _this.game.client.sendEquipInventory(itemId, nftId);
                            _this.game.player.switchWeapon(item);
                            _this.hideInventory();
                            e.preventDefault();
                            e.stopImmediatePropagation();
                        }
                        document.getElementById(item).addEventListener("click", equip);
                    }
                }

                let consumeFunc = function (item) {
                    if (document.getElementById(item) !== null) {
                        let consume = function (e) {
                            let count = parseInt(document.getElementById("count_" + item).innerHTML);
                            if (count > 0){
                                _this.game.client.sendConsumeItem(item);
                                document.getElementById("count_" + item).innerHTML = count - 1;
                            }
                            _this.hideInventory();
                            e.preventDefault();
                            e.stopImmediatePropagation();
                        }
                        document.getElementById(item).addEventListener("click", consume);
                    }
                }

                let newBot = function (item) {
                    if (item.nftId && document.getElementById(item.nftId) !== null) {
                        let spawnBot = function (e) {
                            let botNftId = item.nftId.replace("NFT_", "0x");
                            axios.post("/session/" + _this.storage.sessionId + "/newBot", {botNftId: botNftId}).then(function(response) {
                                console.log("new bot", response);
                            }).catch(function(error) {
                                console.log(error);
                                let errorMsg = error?.response?.data?.error;
                                _this.showMessage(errorMsg);
                            });
                            _this.hideInventory();
                            e.preventDefault();
                            e.stopImmediatePropagation();
                        }
                        document.getElementById(item.nftId).addEventListener("click", spawnBot);
                    }
                }

                weaponInventory.forEach(function (item) {
                    equipFunc(item.nftId);
                });

                specialInventory.forEach(function (item) {
                    equipFunc(item.nftId);
                });

                botsInventory.forEach(function (item) {
                    newBot(item);
                });

                Object.keys(consumablesInventory).forEach(item => {
                    if(consumablesInventory[item].consumable) {
                        consumeFunc(item);
                    }
                });

                _this.hideWindows();
                $('body').addClass('inventory');
            }).catch(function(error) {
                console.error(error);
            });
            this.isInventoryVisible = true;
        },

        hideInventory: function () {
            $('body').removeClass('inventory');
            if (!this.game.player) {
                $('body').addClass('death');
            }
            $('#inventorybutton').removeClass('active');
            this.isInventoryVisible = false;
        },

        toggleSettings: function () {
            _this = this

            if ($('body').hasClass('settings')) {
                this.closeSettings();
            } else {
                this.hideWindows();
                $('body').addClass('settings');
            }

            if (!this.game.player) {
                $('body').toggleClass('death');
            }

        },

        initResourcesDisplay: function () {
            _this = this;

            let inventoryQuery = "/session/" + _this.storage.sessionId + "/inventory";

            axios.get(inventoryQuery).then(function(response) {
                let resourcesInventory = response.data.resources;
                if (Object.keys(resourcesInventory).length > 0) {
                    Object.keys(resourcesInventory).forEach(item => {
                        if (Types.isResource(parseInt(item))) {
                            _this.game.updateResource(parseInt(item), resourcesInventory[item]);
                        }
                    });
                }
            });
        },

        closeInGameCredits: function () {
            $('body').removeClass('credits');
            $('#parchment').removeClass('credits');
            if (!this.game.player) {
                $('body').addClass('death');
            }
        },

        closeSettings: function () {
            $('body').removeClass('settings');
            if (!this.game.player) {
                $('body').addClass('death');
            }
            $('#mutebutton').removeClass('active');
        },

        togglePopulationInfo: function () {
            $('#population').toggleClass('visible');
            if ($('#population').hasClass('visible')) {
                $('#weaponStats').removeClass('visible');
                $('#avatarStats').removeClass('visible');
            }
        },

        toggleAvatarInfo: function (event) {
            $('#avatarStats').toggleClass('visible');
            if ($('#avatarStats').hasClass('visible')) {
               $('#weaponStats').removeClass('visible');
               $('#population').removeClass('visible');
            }

            event.stopImmediatePropagation();
            event.preventDefault();
            return false
        },

        toggleWeaponInfo: function (event) {
            $('#weaponStats').toggleClass('visible');
            if ($('#weaponStats').hasClass('visible')) {
                $('#population').removeClass('visible');
                $('#avatarStats').removeClass('visible');
            }

            event.stopImmediatePropagation();
            event.preventDefault();
            return false
        },

        openPopup: function (type, url) {
            var h = $(window).height(),
                w = $(window).width(),
                popupHeight,
                popupWidth,
                top,
                left;

            switch (type) {
                case 'twitter':
                    popupHeight = 450;
                    popupWidth = 550;
                    break;
                case 'facebook':
                    popupHeight = 400;
                    popupWidth = 580;
                    break;
            }

            top = (h / 2) - (popupHeight / 2);
            left = (w / 2) - (popupWidth / 2);

            newwindow = window.open(url, 'name', 'height=' + popupHeight + ',width=' + popupWidth + ',top=' + top + ',left=' + left);
            if (window.focus) {
                newwindow.focus()
            }
        },

        openShop: function(shopId, shopName) {
            let self = this;
            let shopPopup = $('#shop-popup');
            shopPopup.find('#shop-popup-name').text(shopName);

            let shopInventoryQuery = "/shop/" + shopId + "/inventory";
            axios.get(shopInventoryQuery).then(function(response) {
                let items = response.data;
                shopPopup.find('#shop-popup-items').html('');
                items.forEach(function (item) {

                    let itemHtml = "<div class='item'>";
                    itemHtml += "<div id='" + item.item + "' class='item-image' style='background: url(img/2/item-" + Types.getKindAsString(item.item) + ".png)' />";

                    let levelInfo = "";
                    if (item.level) {
                        levelInfo = "<span class='level'>Lvl&nbsp;" + item.level + "</span>";
                    }

                    itemHtml += "<div class='name'>" + item.name + levelInfo + "</div>";
                    itemHtml += "<div class='desc'>" + item.description + "</div>";
                    itemHtml += "<div class='price'></div>";
                    itemHtml += "</div>";

                    let itemEl  = $(itemHtml);
                    let playerHasEnoughResources = true;
                    Object.keys(item.price).forEach(function (resource) {
                        let resourceEl = $('<div id="resource-' + resource + '" class="resource"><span class="img"></span><span class="amount"></span></div>');
                        let url = "img/1/item-" + resource + ".png";
                        resourceEl.find('.img').css('background-image', "url('" + url + "')");
                        resourceEl.find('.amount').text(item.price[resource]);
                        itemEl.find('.price').append(resourceEl);

                        // Find resource amount in player resource bar and check if player has enough
                        if(parseInt($('#resources').find('#resource-' + Types.getKindFromString(resource)).find('.amount').text()) < parseInt(item.price[resource])) {
                            playerHasEnoughResources = false;
                        }
                    });

                    let playerHasMinimumLevel = true;
                    if ((item.minPlayerLevel ?? 0) > 0) {
                        let resourceEl = $('<div class="minLevel"><span class="img">Lvl</span><span class="amount"> ' + item.minPlayerLevel + '</span></div>');
                        itemEl.find('.price').append(resourceEl);

                        if (self.game.player.level < (item.minPlayerLevel ?? 0)) {
                            playerHasMinimumLevel = false;
                        }
                    }

                    if(!playerHasEnoughResources || !playerHasMinimumLevel) {
                        itemEl.addClass('disabled');
                    } else {
                        itemEl.removeClass('disabled');
                    }

                    itemEl.on('click', function(e) {
                        e.preventDefault();
                        e.stopImmediatePropagation();

                        $('#shop-popup .selected').removeClass('selected');
                        $(e.currentTarget).addClass('selected');
                        $('#shop-confirmation-text').html('Are you sure you want to buy <span class="highlight">' + item.name + '</span>?');
                        $('#shop-confirmation-longtext').html(item.longDescription ?? item.description);
                        $('#shop-confirmation').removeClass('hidden');

                        $('#cancel-shop-purchase').off('click');
                        $('#cancel-shop-purchase').click(function(e) {
                            $('#shop-confirmation').addClass('hidden');
                            itemEl.removeClass('selected');
                            e.preventDefault();
                            e.stopImmediatePropagation();
                        });

                        let itemId = item.id;
                        $('#confirm-shop-purchase').off('click');
                        if(playerHasEnoughResources && playerHasMinimumLevel) {
                            $('#confirm-shop-purchase').click(function (e) {
                                $('#shop-confirmation').addClass('hidden');
                                itemEl.removeClass('selected');
                                e.preventDefault();
                                e.stopImmediatePropagation();
                                self.purchaseShopItem(shopId, itemId);
                            });

                            $('#shop-confirmation-text').show();
                            $('#confirm-shop-purchase').show();
                            $('#cancel-shop-purchase').show();
                            $('#confirm-shop-purchase').removeClass('disabled');
                        } else {
                            $('#shop-confirmation-text').hide();
                            $('#confirm-shop-purchase').hide();
                            $('#cancel-shop-purchase').hide();
                            $('#confirm-shop-purchase').addClass('disabled');
                        }
                    })

                    shopPopup.find('#shop-popup-items').append(itemEl);
                });

                $('#close-shop').click(function(e) {
                    $('#shop-popup').addClass('hidden');
                    $('#shop-confirmation-longtext').html('');
                    $('#shop-confirmation').removeClass('visible').addClass('hidden');
                    e.preventDefault();
                    e.stopImmediatePropagation();
                });

                shopPopup.removeClass("hidden");
                setTimeout(() => {
                    $('#shop-confirmation').addClass('visible');
                }, 1000);
            });
        },

        purchaseShopItem: function(shopId, itemId) {
            let self = this;
            let shopInventoryQuery = "/session/" + _this.storage.sessionId + "/shop/" + shopId + "/buy/" + itemId;
            axios.get(shopInventoryQuery)
                .then(function(response) {
                    self.initResourcesDisplay();
                    self.game.audioManager.playSound("achievement");
                    self.game.showNotification("Purchase successful!");
                })
                .catch(function(error) {
                    console.error(error);
                    let errorMsg = error?.response?.data?.error;
                    self.game.audioManager.playSound("noloot");
                    self.game.showNotification(errorMsg);
                });
        },

        animateParchment: function (origin, destination) {
            var self = this,
                $parchment = $('#parchment'),
                duration = 1;

            if (this.isMobile) {
                $parchment.removeClass(origin).addClass(destination);
            } else {
                if (this.isParchmentReady) {
                    if (this.isTablet) {
                        duration = 0;
                    }
                    this.isParchmentReady = !this.isParchmentReady;

                    $parchment.toggleClass('animate');
                    $parchment.removeClass(origin);

                    setTimeout(function () {
                        $('#parchment').toggleClass('animate');
                        $parchment.addClass(destination);
                    }, duration * 1000);

                    setTimeout(function () {
                        self.isParchmentReady = !self.isParchmentReady;
                    }, duration * 1000);
                }
            }
        },

        animateMessages: function () {
            var $messages = $('#notifications div');

            $messages.addClass('top');
        },

        resetMessagesPosition: function () {
            var message = $('#message2').text();

            $('#notifications div').removeClass('top');
            $('#message2').text('');
            $('#message1').text(message);
        },

        showMessage: function (message) {
            var $wrapper = $('#notifications div'),
                $message = $('#notifications #message2');

            this.animateMessages();
            $message.text(message);
            if (this.messageTimer) {
                this.resetMessageTimer();
            }

            this.messageTimer = setTimeout(function () {
                $wrapper.addClass('top');
            }, 5000);
        },

        resetMessageTimer: function () {
            clearTimeout(this.messageTimer);
        },

        resizeUi: function () {
            if (this.game) {
                if (this.game.started) {
                    this.game.resize();
                    this.initHealthBar();
                    this.game.updateBars();
                } else {
                    var newScale = this.game.renderer.getScaleFactor();
                    this.game.renderer.rescale(newScale);
                }
            }
        },

        showFishing: function () {
            $('#fishingbar').addClass('active');
        },

        hideFishing: function () {
            $('#fishingbar').removeClass('hold');
            $('#fishingbar').removeClass('active');
            $('#bullseye').removeClass('active');
        },

        holdFishing: function (bullseye) {
            $('#fishingbar').removeClass('active');
            $('#fishingbar').addClass('hold');
            if (bullseye){
                $('#bullseye').addClass('active');
            }
        },

        setFishingTarget: function (barHeight, barMarginTop, bullseyeHeight, bullseyeMarginTop) {
            let scale = this.game.renderer.scale;

            $("#fishingtarget").css('height', barHeight * scale + "px");
            $("#fishingtarget").css('margin-top', barMarginTop * scale + "px");
            $("#fishingtargetbullseye").css('height', bullseyeHeight * scale + "px");
            $("#fishingtargetbullseye").css('margin-top', bullseyeMarginTop * scale + "px");
        },

        setFish: function (url) {
            document.getElementById("fish").style.backgroundImage = "url('" + url + "')";
        },

        setFishPos: function (pos) {
            let scale = this.game.renderer.scale;

            $("#fish-box").css('margin-top', pos * scale + "px");
        }
    });

    return App;
});