define([
  'jquery',
  'backbone',
  'socket.io',
  'collections/PlayersCollection',
  'models/PlayerModel',
  'models/LocationModel',
  'models/GameModel',
  'views/PlayerListView',
  'views/PlayerCardView',
  'views/GameWaitingView',
  'collections/WhiteCardsCollection',
  'collections/BlackCardsCollection',
  'models/DeckModel'], function($, Backbone, Socket, PlayersCollection, PlayerModel, LocationModel, GameModel, PlayerListView, PlayerCardView, GameWaitingView, WhiteCardsCollection, BlackCardsCollection, DeckModel){
  var View = Backbone.View.extend({

    el: "section#main",

    initialize: function( id ) {
      console.info( 'GameView initialize()' );
      var self = this,
          socket = io.connect( 'http://localhost:20080' );

      this.id = id;
      window.CAH = {};

      self.socket = socket;

      self.syncFromLocalStorage( id );

      self.joinOrCreateGame();

      self.gameWaitingView = new GameWaitingView().render();
    },

    events: {
      'click #drawWhiteCard': function() {
        this.drawWhiteCard( this );
      },
      'click #beginRound': function() {

      }
    },

    drawWhiteCard: function( self ) {
      self.game.drawWhiteCard( function( card ) {
        var players = self.game.get( 'players' ),
            playerOwner = players.get( self.player.id );
        card.set({ 'socketid': playerOwner.id });
        self.player.addWhiteCard( card );
        playerOwner.set({ 'whitecards' : self.player.get( 'whitecards' ) });
        self.socket.emit( 'update room', self.game );
      });
    },

    updateCards: function( card, self ) {
      self.game.get( 'whitecards' ).get( card )
      self.game.updateCards( data.deck.whitecards, data.deck.blackcards );
    },

    render: function() {
      console.info( 'GameView.render()' );
      this.template = _.template( $("#game-view").html(), { id: this.id } );
      this.playerListView.render();
      this.$el.html(this.template);
      return this;
    },

    updateRoom: function( data, self ) {
      console.group( 'client updating game' );
      var newPlayersCollection = self.updateGamePlayers( data, self ),
          alreadyHidden = ( self.gameWaitingView.$el.find( '#waiting-msg' ).css( 'display' ) == 'none' );

      var newGame = new GameModel( data );
      self.playerListView = new PlayerListView( { collection: newPlayersCollection } );

      newGame.set( { players: newPlayersCollection } );
      this.game.set(
        {
          players: newPlayersCollection
        }
      );

      if( self.game.gameCanBegin() && !alreadyHidden) {
        self.gameWaitingView.hideModal();
      }
      
      newGame.updateCards( data.deck.whitecards, data.deck.blackcards );
      self.game = newGame;

      window.CAH.game = self.game;

      console.log( '%c-----game-----', "color: blue;" );
      console.log( self.game );
      console.groupEnd();
      self.render();
    },

    updateGamePlayers: function( data, self ) {
      var newPlayers = data.players,
          newPlayersCollection = new PlayersCollection();

      for( var i = 0; i < newPlayers.length; i++ ) {
      var whites = new WhiteCardsCollection(),
          blacks = new BlackCardsCollection(),
          p = new PlayerModel( newPlayers[i] );
          
        whites.add( newPlayers[i].whitecards );
        blacks.add( newPlayers[i].blackcards );
        p.set({ 'whitecards': whites, 'blackcards': blacks });
        newPlayersCollection.add( p );
      }
      if( !self.player.socketid ) {
        self.player.set({ 'socketid': newPlayers[newPlayers.length - 1].socketid });
      }

      return newPlayersCollection;
    },

    joinOrCreateGame: function() {
      console.info( 'GameView.joinOrCreateGame()' );
      var self = this;

      self.socket.emit( 'join game', self.game, function( data ) {
        //so this is only called if you're the first person
        //to join a game
        console.group( 'client updating game (response from server)', 'join game' );
        self.updateRoom( data, self );
      });

      self.socket.on( 'update room', function( data ) {
        self.updateRoom( data, self );
      });

      self.socket.on( 'new player', function( player ) {
        self.game.newPlayer( player, self );
      });

      this.socket.on( 'player left', function( badsocketid ) {
        self.game.playerLeft( badsocketid, self );
      });

    },

    syncFromLocalStorage: function() {
      console.log( 'GameView.syncFromLocalStorage()' );
      var gameFromLocalStorageJson = JSON.parse( localStorage.getItem( 'game' ) );
          playerSettingsJson = JSON.parse( localStorage.getItem( 'playerSettings' ) ),
          name = '', //can get player name from PlayerSettings
          self = this;

      if( playerSettingsJson ) {
        //lulz just for debuggins
        name = playerSettingsJson.displayName + ( new Date().getMilliseconds() );
      } else {
        //lulz just for debuggins
        name = 'bob' + ( new Date().getMilliseconds() );
      }
      var player = new PlayerModel( { name: name } );
      if( gameFromLocalStorageJson ) {
        //found a good game object in local storage
        localStorage.removeItem( 'game' );
        var location = gameFromLocalStorageJson.location,
            players = gameFromLocalStorageJson.players;

        this.game = new GameModel( gameFromLocalStorageJson );
        this.game.set(
          {
            location: new LocationModel( location ),
            players: new PlayersCollection( player )
          }
        );
        this.game.get( 'deck' ).loadCards();
      } else {
        //mock one up and join an already existing game
        //to have game obj filled out later via server syncFromLocalStorages
        //only ting that needs set is the id and player
        this.player = player;
        this.game = new GameModel( { id: this.id } );
        this.game.set(
          {
            players: new PlayersCollection( player )
          }
        );
      }
      self.player = player;
      self.playerCardView = new PlayerCardView( { collection: self.player.get( 'whitecards' ) } );
      this.playerListView = new PlayerListView( { collection: this.game.get( 'players' ) } );
    }
  });

  // Returns the View class
  return View;
});







