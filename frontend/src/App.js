import React, { useEffect, useState } from "react";
import Select from "react-select"
import Plot from 'react-plotly.js';
import { Languages, Home, BookOpenText, FilePlus2, FilePenLine, FileX2, History, CircleArrowLeft, CircleArrowRight } from 'lucide-react';

function App() {
  let [loading, setLoading] = useState(false);
  let [activeTab, setActiveTab] = useState("Home");
  let [activeForm, setActiveForm] = useState("create");
  let [graphs, setGraphs] = useState([]);
  let [selectedGraph, setSelectedGraph] = useState(0);
  let [selectedLanguage, setSelectedLanguage] = useState('portuguese');
  let [allCards, setAllCards] = useState([]);
  let [allTags, setAllTags] = useState([]);
  let [availableTags, setAvailableTags] = useState([]);
  let [filteredByTag, setFilteredByTag] = useState([]);
  let [selectedFilterTags, setSelectedFilterTags] = useState([]);

  let [currentCardIndex, setCurrentCardIndex] = useState(0);
  let [currentWordID, setCurrentWordID] = useState(null);
  let [isFlipped, setIsFlipped] = useState(false);

  let [selectedTagsCreate, setSelectedTagsCreate] = useState([]);
  let [selectedCard, setSelectedCard] = useState(null);
  let [selectedTagsEdit, setSelectedTagsEdit] = useState([]);
  let [tagsOfSelectedCard, setTagsOfSelectedCard] = useState([]);  
  let [searchQuery, setSearchQuery] = useState("");
  let [selectedCards, setSelectedCards] = useState([]);

  let [difficultyLevel, setDifficultyLevel] = useState('intermediate');
  let [readingWords, setReadingWords] = useState([]);
  let [title, setTitle] = useState("");
  let [story, setStory] = useState("");
  let [allStories, setAllStories] = useState([]);
  let [showHistory, setShowHistory] = useState(false);

  const logReview = async (resp) => {
    fetch("http://127.0.0.1:5000/log_review", {
      method : 'POST',
      headers : {'Content-Type' : 'application/json'},
      body : JSON.stringify({
        'word_id' : currentWordID,     // <-- Get word_id!!!
        'language' : selectedLanguage,
        'response' : resp
      }),
    })
    .then(response=>response.json())
    .then(data=>console.log(data))
    .catch(error=>console.log("Error logging review: ", error));
  }

  const nextCard = (resp) => {
    logReview(resp);
    setIsFlipped(false);
    let nextCardIndex = (currentCardIndex + 1) % filteredByTag.length
    setCurrentCardIndex(nextCardIndex);
    setCurrentWordID(filteredByTag[nextCardIndex]['id']);
  };

  /*const prevCard = () => {
    setIsFlipped(false);
    let nextCardIndex = currentCardIndex === 0 ? filteredByTag.length - 1 : currentCardIndex - 1
    setCurrentCardIndex(nextCardIndex);
    setCurrentWordID(filteredByTag[nextCardIndex]['id']);
  };*/

  const getAllCards = async () => {
    const response = await fetch("http://127.0.0.1:5000/get_cards", {
      method : "POST",
      headers: {"Content-Type" : "application/json" },
      body : JSON.stringify({
        'language' : selectedLanguage
      }),
    })
    .catch(error => console.error("Error fetching flashcards:", error));

    let data = await response.json();
    data = data.sort((a, b) => b.forget_prob - a.forget_prob);   // Sort by forgetting probability
    setAllCards(data);
    setCurrentWordID(data[currentCardIndex]['id']);
    setSelectedCard(data[currentCardIndex]);

    await getAllTags();
    const tags = getTagsFromCard(data[currentCardIndex]);
    setTagsOfSelectedCard(tags);
    setSelectedTagsEdit(tags);

    let card_ids = selectedFilterTags.map(tag => tag.card_id);
    let cards_with_tags = data.filter(card => card_ids.includes(card.id) === true);    // cards that appear in selected tags only
    let cards_with_no_tags = data.filter(card => card_ids.includes(card.id) === false); // cards that have no tags
    let all_filtered_cards = cards_with_tags.concat(cards_with_no_tags);
    setFilteredByTag(all_filtered_cards);
  }

  const getAllTags = async () => {
    const response = await fetch("http://127.0.0.1:5000/get_tags", {
      method: "POST",
      headers: {"Content-Type" : "application/json"},
      body: JSON.stringify({
        'language': selectedLanguage
      }),
    });

    const data = await response.json();
    setAllTags(data);

    // Get set of available tags (filter out duplicates)
    const uniqueNames = new Set();
    const uniquePairs = [];
    for (const pair of data) {
      const name = pair.name;
      if (!uniqueNames.has(name)) {
        uniqueNames.add(name);
        uniquePairs.push(pair);
      }
    }

    setAvailableTags(uniquePairs);  
    setSelectedFilterTags(uniquePairs);
  }

  const getTagsFromCard = (card) => {
    return allTags.filter(tag=>tag.card_id===card.id);
  }

  const getPlots = async () => {
    const response = await fetch("http://127.0.0.1:5000/get_plots", {
      method: "POST",
      headers: {"Content-Type" : "application/json"},
      body: JSON.stringify({
        'language': selectedLanguage
      }),
    });

    const data = await response.json();
    setGraphs([data['plot1'], data['plot2'], data['plot3'], data['plot4']]);
    setSelectedGraph(0);
  }

  const createCard = async () => {
    const response = await fetch("http://127.0.0.1:5000/create_card", {
      method : "POST",
      headers: {"Content-Type" : "application/json"},
      body : JSON.stringify({
            'language': selectedLanguage,
            'word': document.getElementById('create_word').value,
            'translation': document.getElementById('create_translation').value,
            'tags': selectedTagsCreate.map(tag=>tag.value)
          }),
    });

    const data = await response.json();
    console.log(data);
  }

  const createTagCreate = async () => {
    const response = await fetch("http://127.0.0.1:5000/create_tag", {
      method: "POST",
      headers: {"Content-Type" : "application/json"},
      body: JSON.stringify({
        'name': document.getElementById('create_new_tag_create').value,
        'language': selectedLanguage
      }),
    })

    const data = await response.json();
    console.log(data);
    await getAllTags();
    document.getElementById("create-new-tag-create").value = null;
  }

  const createTagEdit = async () => {
    const response = await fetch("http://127.0.0.1:5000/create_tag", {
      method: "POST",
      headers: {"Content-Type" : "application/json"},
      body: JSON.stringify({
        'name': document.getElementById('create_new_tag_edit').value,
        'language': selectedLanguage
      }),
    })

    const data = await response.json();
    console.log(data);
    await getAllTags();
    document.getElementById("create_new_tag_edit").value = null;
  }

  const editCard = async () => {
    const response = await fetch("http://127.0.0.1:5000/edit_card", {
      method: "PUT",
      headers: {"Content-Type" : "application/json"},
      body : JSON.stringify({
            'id': selectedCard.id,
            'language': selectedLanguage,
            'word': document.getElementById('edit_word').value,
            'translation': document.getElementById('edit_translation').value,
            'tags': selectedTagsEdit.map(tag=>tag.name)
      }),
    });

    const data = await response.json();
    console.log(data);
    await getAllCards();
  }

  const deleteCard = async (card) => {

    const response = await fetch("http://127.0.0.1:5000/delete_card", {
      method : "POST",
      headers: {"Content-Type" : "application/json"},
      body : JSON.stringify({
            'language': selectedLanguage,
            'id': card.id,
            'word': card.word
          }),
    });

    const data = await response.json();
    console.log(data);
    await getAllCards();
  }

  const handleLanguageChange = async (language) => {
    setSelectedLanguage(language);
    //setLoading(true);
  }

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    if (!isFlipped) {
      speakText(filteredByTag[currentCardIndex].translation);
    }
  }

  const handleWordChange = (e) => {
    const selectedWordId = e.value;
    const cardObj = allCards.find((card) => card.id === selectedWordId);
    setSelectedCard(cardObj);
    const tags = getTagsFromCard(cardObj);
    setTagsOfSelectedCard(tags);
    setSelectedTagsEdit(tags);
  };

  const handleTagChange = (selectedValues) =>  {
    /* Get tags to be removed */
    let tagsToRemove = []
    tagsOfSelectedCard.forEach(tag => {
      if (!selectedValues.includes(tag)) { tagsToRemove.push(tag); }
    });
    selectedTagsEdit.forEach(tag => {
      if (!selectedValues.includes(tag)) { tagsToRemove.push(tag); }
    });

    /* Get tags to be added */
    let tagsToAdd = []
    selectedValues.forEach(tag_new => {
      if (!selectedTagsEdit.map(tag_old=>tag_old.name).includes(tag_new.label)){
        tagsToAdd.push(allTags.find(tag => tag.name === tag_new.label));
      }
    });

    /* Update Selected Tags list */
    let tags = selectedTagsEdit.concat(tagsToAdd);
    tags = tags.filter(tag => !tagsToRemove.includes(tag));
    setSelectedTagsEdit(tags);
  }

  const handleCheckboxChange = (card) => {
    setSelectedCards((prev) =>
      prev.includes(card) ? prev.filter((item) => item !== card) : [...prev, card]
    );
  };

  const handleFilterTags = (filterTags) => {
    setSelectedFilterTags(filterTags || []);
  }

  const handleConfirmSelection = () => {
    alert(`Cards to be deleted: ${selectedCards.map(card => `(${card.word} -> ${card.translation})`).join(", ")}`);
    selectedCards.forEach(deleteCard);
  };

  const handleStoryChange = (e) => {
    const story_id = Number(e.target.value);
    const story = allStories.find(story => story.id === story_id);
    setTitle(story.title || "");
    setStory(story.story || "");
    setShowHistory(false);
  }

  const filteredCards = allCards.filter((card) =>
    card.word.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAllStories = async () => {
    const response = await fetch("http://127.0.0.1:5000/get_stories", {
      method : "POST",
      headers: {"Content-Type" : "application/json"},
      body : JSON.stringify({
            'language': selectedLanguage,
          }),
    });

    const data = await response.json();
    setAllStories(data['stories']);
  }

  const generateStory = async () => {
    const response = await fetch("http://127.0.0.1:5000/generate_story", {
      method : "POST",
      headers: {"Content-Type" : "application/json"},
      body : JSON.stringify({
            'language': selectedLanguage,
            'reading_words': readingWords,
            'difficulty': difficultyLevel
          }),
    });

    const data = await response.json();
    setTitle(data['title']);
    setStory(data['story']);
    await getAllStories();
  }

  const speakText = (text) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang_codes[selectedLanguage];
      utterance.rate = 0.85; // Adjust speed (0.1 - 10)
      utterance.pitch = 1; // Adjust pitch (0 - 2)
      speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-Speech is not supported in this browser.");
    }
  };

  const handleSpeech = () => {
    speakText(title);
    speakText(story);
  }

  const stopSpeech = () => {
    speechSynthesis.cancel();
  }

  const tabIcons = {
    Study: <Languages size={48} strokeWidth={2}/>,
    Home: <Home size={48} strokeWidth={2}/>,
    Read: <BookOpenText size={48} strokeWidth={2}/>,
  };

  const formIcons = {
    create: <FilePlus2 size={40} />,
    edit: <FilePenLine size={40} />,
    del: <FileX2 size={40} />
  }

  const lang_codes = {
    english : 'en',
    portuguese: 'pt',
    spanish : 'es',
    french : 'fr',
    russian : 'ru',
    turkish : 'tr',
    arabic : 'ar',
    sudanese : 'su',
    swahili : 'sw',
    persian : 'fa',
    chinese : 'zh',
    japanese : 'ja',
}

  useEffect(() => {
    getAllCards();
    getPlots();
    getAllStories();
  }, []);

  useEffect(() => {
    if (selectedLanguage) {
      getAllCards();
      getPlots();
      getAllStories();
      setTimeout(() => setLoading(false), 5000);
  }
  }, [selectedLanguage]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "50vw",
        width: "100vw",
        backgroundColor: "lightgray",
      }}
    >
      {loading ? (
        <div style={{display:"flex", flex:1, position:"fixed", zIndex:999, justifyContent:"center", alignItems:"center", width:"100%", height:"100%", color:"white", backgroundColor:"#824dff",}} className="loading-screen">
          <h2>Adding New Language to Database...</h2>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            height: "100%",
            width:"100%",
            flexDirection: "column",
            background: "linear-gradient(to bottom, white, lightgray)", // Elegant gradient background
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection:"column",
              //alignItems: "center",
              //justifyContent: "center",
              fontSize: "20px",
              fontWeight: "bold",
            }}
          >
          </div>
          <div style={{ flex: 8, display: "flex", justifyContent:"center", alignItems:"center"}}>
            {activeTab === "Study" && filteredByTag.length > 0 && (
              <div style={{justifyItems:"center", minHeight:"31.2em"}}>
                <div>
                  <div style={{display:"flex", alignItems:"center", marginTop:"1em"}}>
                    <span style={{fontSize:"1.5em"}}>Filter:</span>
                    <Select
                      id="filter_tags"
                      isMulti
                      options={availableTags.map((tag) => ({
                        label: tag.name,
                        value: tag.id,
                      }))}
                      placeholder="select tags..."
                      value={selectedFilterTags.map(tag => ({
                        label: tag.name,
                        value: tag.id,
                      }))}
                      onChange={handleFilterTags}
                      styles={{
                        control: (styles) => ({
                          ...styles,
                          textAlign: "center",
                          margin: "1em",
                        }),
                        multiValue: (styles) => ({
                          ...styles,
                          backgroundColor: "#824dff", // Set selected option background color
                          color: "white", // Set text color for selected options
                          borderRadius: "5px",
                        }),
                        multiValueLabel: (styles) => ({
                          ...styles,
                          color: "white", // Ensure label text color is white in selected options
                        }),
                        multiValueRemove: (styles) => ({
                          ...styles,
                          color: "white", // Style the 'remove' button for the selected option
                          ':hover': {
                            backgroundColor: "#c13cd1", // Change remove button color on hover
                          },
                        }),
                        option: (styles, { isSelected }) => ({
                          ...styles,
                          backgroundColor: isSelected ? "#824dff" : "white", // Set option background color when selected
                          color: isSelected ? "white" : "black", // Set text color when selected
                          ':hover': {
                            backgroundColor: "#d1b3ff", // Lighten color when hovered
                          },
                        }),
                      }}
                    />
                  </div>
                  <div style={{display:"flex", alignItems:"center", justifyContent:"center"}}>
                    <div style={{height:"2em", margin:"1em"}}>
                      {filteredByTag[currentCardIndex] && (
                        allTags.filter(tag => tag.card_id === filteredByTag[currentCardIndex].id).map((curr) => (
                          <p style={{
                            display:"inline-block",
                            margin:"0.2em",
                            padding: "0.3em 0.6em",
                            backgroundColor: "lightgray",
                            borderRadius:"5px"
                          }}>
                            {curr.name}
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div
                  onClick={handleFlip}
                  style={{
                    width: "400px",
                    height: "250px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    //border: "2px solid black",
                    backgroundColor: "white",
                    boxShadow: "0px 16px 24px black",
                    fontSize: "50px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {isFlipped ? filteredByTag[currentCardIndex].translation : filteredByTag[currentCardIndex].word}
                </div>
              </div>
            )}
          </div>
          {activeTab === "Study" && (
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "5em"}}>
              <button onClick={()=>nextCard(0.0)} style={{ padding: "10px", cursor: "pointer", visibility: isFlipped? "visible" : "hidden", backgroundColor:"#9aeb98", borderRadius:"10px", boxShadow: "0px 4px 6px gray",}}>Easy</button>
              <button onClick={()=>nextCard(0.5)} style={{ padding: "10px", cursor: "pointer", visibility: isFlipped? "visible" : "hidden", backgroundColor:"#f7f17c", borderRadius:"10px", boxShadow: "0px 4px 6px gray",}}>Hard</button>
              <button onClick={()=>nextCard(1.0)} style={{ padding: "10px", cursor: "pointer", visibility: isFlipped? "visible" : "hidden", backgroundColor:"#f77c7c", borderRadius:"10px", boxShadow: "0px 4px 6px gray",}}>&nbsp;Fail&nbsp;</button>
            </div>
          )}

          {activeTab === "Home" && (
            <div style={{ backgroundColor: "#f7f7f7", height: "100%", transition: "background-color 0.3s ease" }} id='tab-2-container'>
              {/* Select Language Menu */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "1em",
                  borderTop: "4px solid #d1d5db",
                  borderBottom: "1px solid #e0e0e0",
                  backgroundColor: "white",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                  transition: "all 0.3s ease",
                }}
              >
                <select
                  style={{
                    padding: "8px",
                    width: "200px",
                    textAlign: "center",
                    fontWeight: "bold",
                    color: "black",
                    border: "2px solid black",
                    borderRadius: "5px",
                    backgroundColor: "#f7f7f7",
                    transition: "border-color 0.3s ease, box-shadow 0.3s ease",
                    boxShadow: "0 8px 12px rgba(0, 0, 0, 0.2)", // Added shadow effect
                  }}
                  value={selectedLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  onFocus={(e) => (e.target.style.boxShadow = "0 12px 24px rgba(0, 0, 0, 0.3)")} // Enhance shadow on focus
                  onBlur={(e) => (e.target.style.boxShadow = "0 8px 12px rgba(0, 0, 0, 0.2)")} // Revert shadow when unfocused
                >
                  <option value="spanish">Spanish</option>
                  <option value="portuguese">Portuguese</option>
                  <option value="french">French</option>
                  <option value="arabic">Arabic</option>
                  <option value="sudanese">Sudanese</option>
                  <option value="swahili">Swahili</option>
                  <option value="chinese">Chinese</option>
                </select>
              </div>

              <div id="main-content-container" style={{ display: "flex", flexDirection: "row", flex: 1, transition: "all 0.3s ease" }}>
                <div
                  id="control-panel-container"
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    width: "40%",
                    border: "3px solid #7d43fa",
                    borderRadius: "8px",
                    backgroundColor: "white",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                    margin: "1em",
                  }}
                >
                  <div id="form-btns-container" style={{ display: "flex", flexDirection: "column", width: "30%" }}>
                    <button
                      style={{
                        height: "33.5%",
                        width: "100%",
                        fontSize: "1.5em",
                        fontWeight: "bold",
                        color: activeForm === "create" ? "#5105f5" : "black",
                        backgroundColor: activeForm === "create" ? "#d1d5db" : "white",
                        transition: "background-color 0.3s ease, transform 0.3s ease",
                      }}
                      onClick={() => setActiveForm("create")}
                    >
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: "0.5em" }}>
                        {formIcons['create']}
                        Create
                      </div>
                    </button>

                    <button
                      style={{
                        height: "33.5%",
                        width: "100%",
                        fontSize: "1.5em",
                        fontWeight: "bold",
                        color: activeForm === "edit" ? "#5105f5" : "black",
                        backgroundColor: activeForm === "edit" ? "#d1d5db" : "white",
                        transition: "background-color 0.3s ease, transform 0.3s ease",
                      }}
                      onClick={() => setActiveForm("edit")}
                    >
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: "0.5em" }}>
                        {formIcons['edit']}
                        Edit
                      </div>
                    </button>

                    <button
                      style={{
                        height: "33.5%",
                        width: "100%",
                        fontSize: "1.5em",
                        fontWeight: "bold",
                        color: activeForm === "del" ? "#5105f5" : "black",
                        backgroundColor: activeForm === "del" ? "#d1d5db" : "white",
                        transition: "background-color 0.3s ease, transform 0.3s ease",
                      }}
                      onClick={() => setActiveForm("del")}
                    >
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: "0.5em" }}>
                        {formIcons['del']}
                        Delete
                      </div>
                    </button>
                  </div>

                  <div id="forms-container" style={{ flex: 1, alignContent: "center", paddingBottom: "1em" }}>
                    {activeForm === "create" && (
                      <div id="create-form-container" style={{ display: "flex", flexDirection: "column", margin: "2em", alignItems: "center" }}>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "20px",
                            alignItems: "center",
                            opacity: 0.9,
                            transition: "opacity 0.3s ease",
                          }}
                        >
                          <input
                            id="create_translation"
                            type="text"
                            placeholder={String(selectedLanguage).charAt(0).toUpperCase() + String(selectedLanguage).slice(1)}
                            style={{
                              padding: "12px",
                              width: "220px",
                              border: "2px solid #7d43fa",
                              borderRadius: "5px",
                              transition: "border-color 0.3s ease",
                            }}
                          />
                          <input
                            id="create_word"
                            type="text"
                            placeholder="English"
                            style={{
                              padding: "12px",
                              width: "220px",
                              border: "2px solid #7d43fa",
                              borderRadius: "5px",
                              transition: "border-color 0.3s ease",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <Select
                            id="create_tag"
                            isMulti
                            options={availableTags.map((tag) => ({
                              label: tag.name,
                              value: tag.id,
                            }))}
                            placeholder="Add tags"
                            value={selectedTagsCreate}
                            onChange={setSelectedTagsCreate}
                            styles={{
                              control: (styles) => ({
                                ...styles,
                                textAlign: "center",
                                marginTop: "1.5em",
                                marginBottom: "0.5em",
                                width: "220px",
                                fontSize: "0.8em",
                                borderColor: "#7d43fa",
                              }),
                            }}
                          />
                          <div style={{ position: "relative", display: "inline-block" }}>
                            <input
                              id="create_new_tag_create"
                              type="text"
                              placeholder="Or create a new tag"
                              style={{
                                padding: "12px",
                                width: "220px",
                                paddingRight: "40px",
                                boxSizing: "border-box",
                                border: "1px solid #7d43fa",
                                borderRadius: "5px",
                                fontSize: "0.8em",
                              }}
                            />
                            <button
                              style={{
                                position: "absolute",
                                right: "5px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                padding: "5px 10px",
                                color: 'white',
                                backgroundColor:"#8e69ff",
                                fontWeight: 'bold',
                                fontSize: '1.05em',
                                border: "2px",
                                borderColor: '#5105f5',
                                borderRadius: "50%",
                                cursor: "pointer",
                                transition: "background-color 0.3s ease",
                              }}
                              onClick={createTagCreate}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <button
                          style={{
                            padding: "12px",
                            cursor: "pointer",
                            marginTop: "5em",
                            width: "10em",
                            backgroundColor: "#7d43fa",
                            color: "white",
                            fontWeight: "bold",
                            borderRadius: "5px",
                            transition: "background-color 0.3s ease, transform 0.3s ease",
                          }}
                          onClick={createCard}
                        >
                          Create Card
                        </button>
                      </div>
                    )}

                    {/* Edit Select List */}
                    {activeForm === "edit" && (
                      <div id='edit-form-container' style={{display:"flex", flexDirection: "column", alignItems:"center", margin:"1em"}}>
                        <Select
                          value={{
                            label: selectedCard.translation + "   -   " + selectedCard.word,
                            value: selectedCard.id
                          }}
                          onChange={handleWordChange}
                          options={allCards
                              .sort((a, b) => a.translation.localeCompare(b.translation))  // Sort alphabetically by card.word
                              .map((card) => ({
                                label: card.translation + "   -   " + card.word,
                                value: card.id,
                              })
                          )}
                          placeholder="Select card to edit"
                          styles={{
                            control: (styles) => ({
                              ...styles,
                              textAlign: "center",
                              margin: "1em",
                              width: "225px",
                              border: " 2px solid #7d43fa",
                            }),
                          }}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            alignItems: "center"
                          }}
                        >
                          <input id='edit_translation'
                            type="text" value={selectedCard?.translation || ""}
                            onChange={(e) => setSelectedCard({...selectedCard, translation: e.target.value})}
                            style={{ padding: "10px", width: "200px", border: " 2px solid #7d43fa", borderRadius: "3px",}}
                          />
                          <input id='edit_word' type="text"
                            value={selectedCard?.word || ""}
                            onChange={(e) => setSelectedCard({...selectedCard, word: e.target.value})}
                            style={{ padding: "10px", width: "200px", border: " 2px solid #7d43fa", borderRadius: "3px",}}
                          />
                          {/* Tag Selection or Entry */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center"}}>
                            <Select
                              id="create_tag"
                              isMulti
                              options={availableTags.map((tag) => ({
                                label: tag.name,
                                value: tag.id,
                              }))}
                              placeholder="Add tags"
                              value={selectedTagsEdit.map(tag=>({'label':tag.name, 'value':tag.name}))}
                              onChange={handleTagChange}
                              styles={{
                                control: (styles) => ({
                                  ...styles,
                                  textAlign: "center",
                                  width:"200px",
                                  marginTop: "1em",
                                  marginBottom: "0.5em",
                                  fontSize:"0.8em",
                                  border: " 1px solid #7d43fa",
                                  borderRadius: "3px",
                                }),
                              }}
                            />
                            <div style={{ position: "relative", display: "inline-block", marginBottom:"1em"}}>
                              <input
                                id="create_new_tag_edit"
                                type="text"
                                placeholder="Or create a new tag"
                                style={{
                                  padding: "10px",
                                  width: "200px",
                                  paddingRight: "40px", // Add space for the button
                                  boxSizing: "border-box",
                                  border: " 1px solid #7d43fa",
                                  borderRadius:"3px",
                                  fontSize:"0.8em",
                                }}
                              />
                              <button
                                style={{
                                  position: "absolute",
                                  right: "5px",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  padding: "5px 10px",
                                  color: 'white',
                                  fontWeight:'bold',
                                  fontSize:'1.05em',
                                  border: "2px",
                                  backgroundColor:'#8e69ff',
                                  borderRadius: "50%",
                                  cursor: "pointer",
                                }}
                                onClick={createTagEdit}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                        <button
                          style={{
                            padding: "10px",
                            cursor: "pointer",
                            marginTop: "10px",
                            width: "10em",
                            height:"3.2em",
                            backgroundColor: "#7d43fa",
                            color: "white",
                            fontWeight: "bold",
                            borderRadius: "5px",
                            transition: "background-color 0.3s ease, transform 0.3s ease",
                          }}
                          onClick={editCard}
                          disabled = {!selectedCard}
                        >
                          Edit Card
                        </button>
                      </div>
                    )}

                    {/* Delete Select List */}
                      {activeForm === "del" && (
                      <div id='delete-form-container' style={{ display: "flex", flexDirection: "column", margin: "2em", alignItems:"center"}}>
                        {/* Search Input */}
                        <input
                          type="text"
                          placeholder="Search cards"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{ padding: "10px", marginBottom: "10px", width: "200px", border: "2px solid #7d43fa", borderRadius:"3px"}}
                        />
                        <div
                          style={{
                            display:"flex",
                            height:"18em",
                            //width:"17em",
                            overflowY:"scroll",
                            border: "1px solid gray",
                            padding: "5px",
                            background:"white",
                            border: "3px solid #7d43fa",
                            borderRadius:"7px",
                          }}
                        >
                          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {filteredCards.length > 0 ? (
                              filteredCards
                              .sort((a, b) => a.word.localeCompare(b.word))  // Sort alphabetically by card.word
                              .map((card) => (
                                <li key={card.id} style={{ display: "flex", alignItems: "center", border:"1px solid black", borderBottom:"0px", background: selectedCards.includes(card) ? "#c6b3ff" : "white"}}>
                                  <input
                                    type="checkbox"
                                    checked={selectedCards.includes(card)}
                                    onChange={() => handleCheckboxChange(card)}
                                    style={{
                                      accentColor: selectedCards.includes(card) ? "#8a08fc" : "initial", // Change checkbox color
                                      transition: "background-color 0.3s ease, transform 0.3s ease", // Add transition
                                    }}
                                  />
                                  <label style={{ marginLeft: "10px", marginRight:"10px"}}>
                                    <div style={{display:"flex", flexDirection:"row", width:"15em", justifyContent:"space-between"}}>
                                      <div>
                                        {card.word}
                                      </div>
                                      <div>
                                        {card.translation}
                                      </div>
                                    </div>
                                  </label>
                                </li>
                              ))
                            ) : (
                              <li style={{ textAlign: "center", color: "gray" }}>No results found</li>
                            )}
                          </ul>
                        </div>
                        
                        <button
                          style={{
                            padding: "10px",
                            cursor: "pointer",
                            marginTop: "10px",
                            width: "10em",
                            height:"3.2em",
                            backgroundColor: "#7d43fa",
                            color: "white",
                            fontWeight: "bold",
                            borderRadius: "5px",
                            transition: "background-color 0.3s ease, transform 0.3s ease",
                          }}
                          onClick={handleConfirmSelection}
                          disabled={selectedCards.length === 0}
                        >
                          Delete Cards
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div id="plots-container" style={{display:"flex", flexDirection:"column", alignItems:"center", background:"white", border:"3px solid black"}}>
                  {graphs[selectedGraph]?.data && graphs[selectedGraph]?.layout ? (
                    <Plot
                      data={graphs[selectedGraph]?.data}
                      layout={graphs[selectedGraph]?.layout}
                      config={graphs[selectedGraph]?.config}
                      style={{flexGrow:1, maxHeight:"500px"}}
                    />
                  ) : (
                    <div style={{alignContent:"center", justifyItems:"center", width:"700px", height:"700px"}}>
                      <p style={{fontSize:"1.5em"}}>Loading graphs...</p>
                    </div>
                  )}
                  <div style={{}}>
                      <CircleArrowLeft  size={32} style={{marginRight:"1em"}} onClick={() => setSelectedGraph((selectedGraph-1+graphs.length)%graphs.length)} cursor="pointer"/>
                      <CircleArrowRight size={32} style={{marginLeft:"1em"}} onClick={() => setSelectedGraph((selectedGraph+1)%graphs.length)} cursor="pointer"/>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === "Read" && (
            <div style={{display:"flex", flexDirection:"column", height:"100%", alignItems:"center"}}>
              <div style={{display:"flex", flexDirection:"column", marginTop:"2em", justifyContent:"center"}}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <label style={{ marginRight: "8em", fontSize: "1.2em", fontWeight: "bold" }}>
                  <input
                    type="radio"
                    name="difficultyLevel"
                    value="beginner"
                    checked={difficultyLevel === "beginner"}
                    onChange={(e) => setDifficultyLevel(e.target.value)}
                    style={{
                      accentColor: "#824dff", // Change accent color to match the gradient
                      marginRight: "0.5em",
                    }}
                  />
                  Beginner
                </label>
                <label style={{ marginRight: "8em", fontSize: "1.2em", fontWeight: "bold" }}>
                  <input
                    type="radio"
                    name="difficultyLevel"
                    value="intermediate"
                    checked={difficultyLevel === "intermediate"}
                    onChange={(e) => setDifficultyLevel(e.target.value)}
                    style={{
                      accentColor: "#824dff", // Change accent color to match the gradient
                      marginRight: "0.5em",
                    }}
                  />
                  Intermediate
                </label>
                <label style={{ fontSize: "1.2em", fontWeight: "bold" }}>
                  <input
                    type="radio"
                    name="difficultyLevel"
                    value="advanced"
                    checked={difficultyLevel === "advanced"}
                    onChange={(e) => setDifficultyLevel(e.target.value)}
                    style={{
                      accentColor: "#824dff", // Change accent color to match the gradient
                      marginRight: "0.5em",
                    }}
                  />
                  Advanced
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "row", width: "100%", alignItems: "center" }}>
                <Select
                  placeholder="Select vocabulary words..."
                  isMulti
                  onChange={(e) => setReadingWords(e)}
                  styles={{
                    control: (styles) => ({
                      ...styles,
                      width: "40em",
                      marginTop: "1em",
                      marginBottom: "2em",
                      backgroundColor: "white",
                      borderRadius: "8px",
                      boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.2)",
                      border: "1px solid #824dff", 
                      ":hover": {
                        border: "1px solid #a070ff",
                      },
                    }),
                    multiValue: (styles) => ({
                      ...styles,
                      backgroundColor: "#824dff",
                      color: "white",
                      borderRadius: "5px",
                    }),
                    multiValueLabel: (styles) => ({
                      ...styles,
                      color: "white",
                    }),
                    multiValueRemove: (styles) => ({
                      ...styles,
                      color: "white",
                      ":hover": {
                        backgroundColor: "#c13cd1",
                      },
                    }),
                  }}
                  options={allCards.map((card) => ({
                    label: card.translation,
                    value: card.id,
                  }))}
                />

                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginLeft: "2em" }}>
                  <button
                    onClick={generateStory}
                    style={{
                      padding: "10px 20px",
                      fontWeight: "bold",
                      backgroundColor: "#7d43fa",
                      color: "white",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.3s ease, transform 0.2s ease",
                      ":hover": {
                        backgroundColor: "#6a32e5",
                        transform: "scale(1.05)",
                      },
                    }}
                  >
                    Generate Story
                  </button>

                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    style={{
                      marginLeft: "1.5em",
                      width: "3.5em",
                      height: "3.5em",
                      backgroundColor: "#824dff",
                      color: "white",
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.2)",
                      transition: "background 0.3s ease, transform 0.2s ease",
                      ":hover": {
                        backgroundColor: "#6a32e5",
                        transform: "scale(1.1)",
                      },
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <History />
                      <span style={{ fontSize: "0.75em", marginTop: "0.2em" }}>History</span>
                    </div>
                  </button>
                </div>

                {showHistory && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      padding: "1.5em",
                      background: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #ccc",
                      borderRadius: "12px",
                      boxShadow: "0px 6px 12px rgba(0, 0, 0, 0.15)",
                    }}
                  >
                    <select
                      onChange={handleStoryChange}
                      style={{
                        width: "220px",
                        padding: "0.5em",
                        borderRadius: "8px",
                        border: "1px solid #824dff",
                        fontSize: "1em",
                        backgroundColor: "white",
                        color: "black",
                        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
                      }}
                    >
                      <option value="">Select Story</option>
                      {allStories.map((story) => (
                        <option key={story.id} value={story.id}>
                          {story.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              </div>
              <div style={{ display: "flex", width:"100%", justifyContent:"center"}}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5em", marginRight: "1em",}}>
                  <button 
                    style={{
                      padding: "0.5em",
                      fontSize: "1em",
                      borderRadius: "5px",
                      backgroundColor: "#7d43fa",
                      color: "white",
                      border: "none",
                      cursor: "pointer"
                    }}
                    onClick={handleSpeech}
                  >
                    🔊 Read
                  </button>
                  <button 
                    style={{
                      padding: "0.5em",
                      fontSize: "1em",
                      borderRadius: "5px",
                      backgroundColor: "#ff4d4d",
                      color: "white",
                      border: "none",
                      cursor: "pointer"
                    }}
                    onClick={stopSpeech}
                  >
                    ⏹ Stop
                  </button>
                </div>

                {/* Story Box */}
                <div id="story-box"
                  style={{
                    width: "60%",
                    height: "15.5em",
                    marginLeft: "0.3em",
                    marginRight: "3em",
                    marginBottom: "1em",
                    paddingTop: "3em",
                    paddingLeft: "4em",
                    paddingRight: "4em",
                    overflowY: "scroll",
                    backgroundColor: "white",
                    border: "6px inset #e5e1eb",
                    borderRadius: "5px",
                    fontSize: "1.5em",
                    lineHeight: "1.8",
                  }}
                >
                  <h2 style={{ textAlign: "center" }}>{title}</h2>
                  {story}
                </div>
              </div>
            </div>
          )}

          <div id="tab-btn-container" style={{ display: "flex", height:"6%", minHeight:"5.7em"}}>
            {["Study", "Home", "Read"].map((tab, index) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  paddingTop: "0.7em",
                  paddingBottom:"3em",
                  height:"100%",
                  fontSize:"0.8em",
                  fontWeight:"bold",
                  border: activeTab === tab ? "9px inset #5105f5" : "4px outset #efe6fc",
                  backgroundColor: activeTab === tab ? "#7d43fa" : "white",
                  cursor: "pointer",
                }}
              >
                <div style={{display:"flex", flexDirection:"column", alignItems:"center", padding:"0.5em", color: activeTab === tab? "white" : "black"}}>
                  {tabIcons[tab]}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
