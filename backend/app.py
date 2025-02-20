import time
from datetime import datetime
import requests
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import numpy as np
import plotly
import plotly.graph_objs as go
import openai
import pickle
import numpy as np

with open('../backend/model.pkl', 'rb') as model_file:
    model = pickle.load(model_file)

with open('../backend/scaler.pkl', 'rb') as scaler_file:
    scaler = pickle.load(scaler_file)

app = Flask(__name__)
CORS(app)

def get_db_connection():
    conn = sqlite3.connect('../backend/languages.db')
    conn.row_factory = sqlite3.Row
    return conn

def create_table (target_lang):
    """ Create a table for a new target language """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    create_table = """
                CREATE TABLE {language} (
                word_id INTEGER PRIMARY KEY,
                translation1 VARCHAR(50),
                translation2 VARCHAR (50),
                translation3 VARCHAR(50),
                FOREIGN KEY (word_id) REFERENCES english (id)ON DELETE CASCADE ON UPDATE CASCADE
            ); """.format(language=target_lang)

    cursor.execute(create_table)
    conn.commit()

def add_translation(word_id, word, translation, target_lang_table):
    """ Add translation to target language table """
    conn = get_db_connection()
    cursor = conn.cursor()

    print("Adding   (", word, "->", translation, ")   to ", target_lang_table)
    insert_query = f"INSERT INTO {target_lang_table} (word_id, translation1) VALUES (?, ?);"
    
    cursor.execute(insert_query, (word_id, translation))
    conn.commit()

def translate_text(text, source_lang, target_lang):
    """ Translate a word with MyMemory API """

    url = "https://api.mymemory.translated.net/get"
    params = {
        "q": text,
        "langpair": f"{source_lang}|{target_lang}"
    }
    
    response = requests.get(url, params=params)
    
    if response.status_code == 200:
        return response.json()["responseData"]["translatedText"]
    else:
        return f"Error: {response.status_code}"

def convert_pos_to_tags(language):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    rows = list(cursor.execute("SELECT id, pos FROM english;"))

    for row in rows:
        card_id, pos = row
        print("Adding ", pos, " to ", card_id, " - ", language, " ", "tags.")

        # Check if tag exists
        cursor2 = conn.cursor()
        cursor2.execute("SELECT id FROM tags WHERE name = ?", (pos,))
        tag_id = cursor2.fetchone()

        if tag_id is None:
            cursor2.execute("INSERT INTO tags (name) VALUES (?)", (pos,))
            conn.commit()
            tag_id = cursor2.lastrowid
        else:
            tag_id = tag_id[0]

        # Add card_id, tag_id to card_tags table
        cursor2.execute("INSERT INTO card_tags (card_id, tag_id, language) VALUES (?, ?, ?)", (card_id, tag_id, language,))
        conn.commit()

def add_new_language(target_lang):
    """ Add a new language """
    conn = get_db_connection()
    cursor = conn.cursor()

    create_table(target_lang)

    lang_codes = {
        'english' : 'en',
        'portuguese': 'pt',
        'spanish' : 'es',
        'french' : 'fr',
        'russian' : 'ru',
        'turkish' : 'tr',
        'arabic' : 'ar',
        'sudanese' : 'su',
        'swahili' : 'sw',
        'persian' : 'fa',
        'chinese' : 'zh',
        'japanese' : 'ja',
    }

    cursor.execute("SELECT english.id, english.word FROM english")
    
    for row in cursor.fetchall():
        word_id = row[0]
        word = row[1]
        
        translation = translate_text(word, lang_codes['english'], lang_codes[target_lang])
        add_translation(word_id, word, translation, target_lang)
        
    convert_pos_to_tags(target_lang)
    conn.commit()
    conn.close()


def get_last_review_time(word_id, language):
    """Get the timestamp of the last review for this user and card."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT timestamp FROM reviews
        WHERE word_id = ?
        AND language = ?
        ORDER BY timestamp DESC
        LIMIT 1;
    """, (word_id, language,))
    last_review = cursor.fetchone()
    conn.close()
    
    if last_review:
        parsed_time = datetime.strptime(last_review[0], "%Y-%m-%d %H:%M:%S.%f")
        return time.time() - time.mktime(parsed_time.timetuple())  #time.mktime(time.strptime(last_review[0], "%Y-%m-%d %H:%M:%S.%f"))
    return None  # First-time review

def get_success_rate(word_id, language):
    """Calculate the success rate for a given user and card."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Count total attempts
    cursor.execute("""
        SELECT COUNT(*) FROM reviews
        WHERE word_id = ?
        AND language = ?;
    """, (word_id, language,))
    total_attempts = cursor.fetchone()[0]

    if total_attempts == 0:
        return 0.0  # Avoid division by zero

    # Count successful attempts
    cursor.execute("""
        SELECT COUNT(*) FROM reviews
        WHERE word_id = ?
        AND language = ?
        AND response IN (0, 0.5);
    """, (word_id, language,))
    successful_attempts = cursor.fetchone()[0]

    success_rate = successful_attempts / total_attempts

    conn.close()
    return success_rate

def get_num_times_seen(word_id, language):
    "Get the number of times a card has been reviewed by user"
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) FROM reviews
        WHERE word_id = ?
        AND language = ?;
    """, (word_id, language))

    return cursor.fetchone()[0]

def make_plots(language):
    conn = get_db_connection()
    cursor = conn.cursor()

    # X: recent days
    # Y: num words studied
    recent_reviews = cursor.execute(f"""
    SELECT DATE(timestamp), COUNT(*) AS COUNT
    FROM reviews
    WHERE language = '{language}'
    GROUP BY DATE(timestamp)
    ORDER BY DATE(timestamp);
    """).fetchall()
    dates = [row[0] for row in recent_reviews]
    counts = [row[1] for row in recent_reviews]
    fig1 = go.Figure(data=[go.Bar(x=dates, y=counts)])
    fig1.update_layout(title="Number of Words per Day", width=750, height=500)
    graphJSON1 = json.dumps(fig1, cls=plotly.utils.PlotlyJSONEncoder)
    graphDict1 = json.loads(graphJSON1)

    # X: Cards
    # Y: Success Rate
    cards = cursor.execute(f"""
    SELECT english.id AS id, english.word AS word, {language}.translation1 AS translation
    FROM english
    JOIN {language} ON english.id = {language}.word_id
    """).fetchall()
    card_names = [row[2] for row in cards]

    success_rates = [get_success_rate(row[0], language) for row in cards]
    success_dict = dict(zip(card_names, success_rates))
    success_dict_sorted = dict(sorted(success_dict.items(), key=lambda card:card[1], reverse=True))
    fig2 = go.Figure(data=[go.Bar(x=list(success_dict_sorted.keys())[:100], y=list(success_dict_sorted.values())[:100])])
    fig2.update_layout(title="Success Rates of Words", width=750, height=500)
    graphJSON2 = json.dumps(fig2, cls=plotly.utils.PlotlyJSONEncoder)
    graphDict2 = json.loads(graphJSON2)

    # X: Cards
    # Y: num times seen
    cards = cursor.execute(f"""
    SELECT english.id AS id, english.word AS word, {language}.translation1 AS translation
    FROM english
    JOIN {language} ON english.id = {language}.word_id
    """).fetchall()
    card_names = [row[2] for row in cards]
    nums_time_seen = [get_num_times_seen(row[0], language) for row in cards]
    times_seen_dict = dict(zip(card_names, nums_time_seen))
    times_seen_dict_sorted = dict(sorted(times_seen_dict.items(), key=lambda card:card[1], reverse=True))
    fig3 = go.Figure(data=[go.Bar(x=list(times_seen_dict_sorted.keys())[:100], y=list(times_seen_dict_sorted.values())[:100])])
    fig3.update_layout(title="Number of Times Seen per Word", width=750, height=500)
    graphJSON3 = json.dumps(fig3, cls=plotly.utils.PlotlyJSONEncoder)
    graphDict3 = json.loads(graphJSON3)

    # X: Cards
    # Y: estimated forgetting probability
    cards = cursor.execute(f"""
    SELECT english.id AS id, english.word AS word, {language}.translation1 AS translation
    FROM english
    JOIN {language} ON english.id = {language}.word_id
    """).fetchall()
    card_names = [row[2] for row in cards]
    forget_probs = [predict_forgetting(row[0], language) for row in cards]
    forget_probs_dict = dict(zip(card_names, forget_probs))
    forget_probs_dict_sorted = dict(sorted(forget_probs_dict.items(), key=lambda card:card[1], reverse=True))
    fig4 = go.Figure(data=[go.Bar(x=list(forget_probs_dict_sorted.keys())[:100], y=list(forget_probs_dict_sorted.values())[:100])])
    fig4.update_layout(title="Forget Probability", width=750, height=500)
    graphJSON4 = json.dumps(fig4, cls=plotly.utils.PlotlyJSONEncoder)
    graphDict4 = json.loads(graphJSON4)
    
    return (graphDict1, graphDict2, graphDict3, graphDict4)

def predict_forgetting(word_id, language):
    time_since_last_review = get_last_review_time(word_id, language)
    success_rate = get_success_rate(word_id, language)
    num_times_seen = get_num_times_seen(word_id, language)

    if (time_since_last_review is None):
        return 1

    features = np.array([[time_since_last_review, success_rate, num_times_seen]])
    features_scaled = scaler.transform(features)
    prediction_proba = model.predict_proba(features_scaled)[:, 1]  # Prob of failure

    return prediction_proba.tolist()[0]

### Routes ###

@app.route('/get_cards', methods=["OPTIONS", "POST"])
def get_cards():
    print("GETTING CARDS")
    if request.method == "OPTIONS":
        return '', 204
    
    conn = get_db_connection()
    cursor = conn.cursor()

    data = request.json
    
    language = data['language']

    # Check if table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (language,))
    if cursor.fetchone() is None:
        # Create table
        print("Creating ", language, " table...")
        add_new_language(language)

    query = f"""
    SELECT english.id AS id, english.word AS word, {language}.translation1 AS translation
    FROM english
    JOIN {language} ON english.id = {language}.word_id
    """
    cards = cursor.execute(query).fetchall()
    cards = [dict(row) for row in cards]
    for d in cards:
        prob_forget = predict_forgetting(d['id'], language)
        d['forget_prob'] = prob_forget

    conn.close()
    return jsonify(cards)

@app.route('/get_tags', methods=['POST'])
def get_tags():
    conn = get_db_connection()
    cursor = conn.cursor()

    data = request.json
    query = f"""
    SELECT card_tags.card_id AS card_id, tags.name AS name
    FROM tags
    LEFT JOIN card_tags ON card_tags.tag_id = tags.id
    WHERE card_tags.language = '{data['language']}'
    """
    tags = cursor.execute(query).fetchall()

    return jsonify([dict(tag) for tag in tags])

@app.route('/get_plots', methods=['POST'])
def get_plots():
    data = request.json
    language = data['language']
    plots = make_plots(language)
    return jsonify({'plot1':plots[0], 'plot2':plots[1], 'plot3':plots[2], 'plot4':plots[3]})

@app.route('/create_card', methods=['POST'])
def create_card():
    conn = get_db_connection()
    cursor = conn.cursor()
    data = request.json

    # Add word to English table
    cursor.execute("INSERT INTO english (word) VALUES (?)", (data['word'],))
    conn.commit()

    # Get id of the word just added
    cursor.execute("SELECT id FROM english WHERE word = ?", (data['word'],))
    word_id_row = cursor.fetchone()
    if word_id_row is None:
        conn.close()
        return jsonify({'error': 'Failed creating card'}), 500
    word_id = word_id_row[0]

    # Add translation to language table
    cursor.execute(f"INSERT INTO {data['language']} (word_id, translation1) VALUES (?, ?)", (word_id, data['translation'],))
    conn.commit()

    # Add card_id, tag_id, language to card_tags table
    tags = data['tags']
    for tag in tags:
        tag_id = cursor.execute("SELECT tags.id FROM tags WHERE tags.name = ?", (tag,)).fetchone()[0]
        cursor.execute("INSERT INTO card_tags (card_id, tag_id, language) VALUES (?, ?, ?)", (word_id, tag_id, data['language'],))

    conn.close()
    return jsonify({'message': 'New card added', 'id': word_id, 'word': data['word']}), 201

@app.route("/create_tag", methods=["POST"])
def create_tag():
    conn = get_db_connection()
    cursor = conn.cursor()

    data = request.json

    # Make sure tag is not already in table
    cursor.execute("SELECT tags.id FROM tags WHERE tags.name = ?", (data['name'],))
    tag_id = cursor.fetchone()
    if tag_id is not None:
        tag_id = tag_id[0]
        return jsonify({'message': 'tag already exists', 'name':data['name'], 'id':tag_id})

    # Add tag to table
    cursor.execute("INSERT INTO tags(name, language) VALUES (?, ?)", (data['name'], data['language']))
    
    conn.commit()
    conn.close()
    return jsonify({'message': 'New tag added', 'name':data['name']})

@app.route('/edit_card', methods=["PUT"])
def edit_card():
    conn = get_db_connection()
    cursor = conn.cursor()
    data = request.json

    # Update word to english table
    cursor.execute("UPDATE english SET word = ?, WHERE id = ?", (data['word'], data['id'],))

    # Update translation in language table
    cursor.execute(f"UPDATE {data['language']} SET translation1 = ? WHERE word_id = ?", (data['translation'], data['id']))

    # Reset tags for card
    cursor.execute("DELETE FROM card_tags WHERE card_tags.language = ? AND card_tags.card_id = ?", (data['language'], data['id'],))
    conn.commit()
    tags = data['tags']
    for tag in tags:
        tag_id = cursor.execute("SELECT tags.id FROM tags WHERE tags.name = ?", (tag,)).fetchone()[0]
        cursor.execute("INSERT INTO card_tags (card_id, tag_id, language) VALUES (?, ?, ?)", (data['id'], tag_id, data['language'],))
        conn.commit()

    conn.close()
    return jsonify({'message': 'Card updated', 'word': data['word'], 'language': data['language'], 'translation': data['translation'], 'tags':data['tags']})

@app.route('/delete_card', methods=["POST"])
def delete_card():
    conn = get_db_connection()
    cursor = conn.cursor()

    data = request.json
    cursor.execute(f"DELETE FROM {data['language']} WHERE word_id = ?", (data['id'],))

    conn.commit()
    conn.close()
    return jsonify({'message': 'Card deleted'})

@app.route('/log_review', methods=["POST"])
def log_review():
    data = request.json
    word_id = data["word_id"]
    language= data["language"]
    response = data["response"]

    time_since_last_review = get_last_review_time(word_id, language)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
    success_rate = get_success_rate(word_id)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO reviews (word_id, language, timestamp, time_since_last_review, success_rate, response)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (word_id, language, timestamp, time_since_last_review, success_rate, response,))
    conn.commit()
    conn.close()

    return jsonify({'message': 'review logged', 'word_id': word_id, 'response': response, 'timestamp':timestamp})

@app.route('/get_stories', methods=["POST"])
def get_stories():
    data = request.json
    language = data['language']

    conn = get_db_connection()
    cursor = conn.cursor()

    stories = cursor.execute("""
        SELECT stories.id AS id, stories.title AS title, stories.story AS story, stories.difficulty AS difficulty, stories.language AS language
        FROM stories
        WHERE stories.language = ?
    """, (language,)).fetchall()
    
    stories = [dict(s) for s in stories]
    for story in stories:
        story_id = story['id']
        word_ids = cursor.execute("""
        SELECT story_words.word_id AS word_id
        FROM story_words
        WHERE story_words.story_id = ?
        """, (story_id, )).fetchall()
        word_ids = [w[0] for w in word_ids]
        story['words'] = word_ids

    return jsonify({'stories':stories})

@app.route('/generate_story', methods=["POST"])
def generate_story():
    data = request.json
    language = data['language']
    words = [w['label'] for w in data['reading_words']]
    word_ids = [w['value'] for w in data['reading_words']]
    difficulty = data['difficulty']
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": f"You are a legendary story-teller from Brazil that tells captivating stories in {language}."},
            {"role":"user", "content":f"Tell me a story in {language} that include the following words: {', '.join(words)}."
                                      f"The story should be fit for a {difficulty}-level speaker of {language}."
                                      f"Provide a title for the story, separated from the main story with '### Title: '."
                                      }
        ],
        max_tokens=500,
        temperature=1
    )

    # Extract Title
    story_text = response.choices[0].message.content
    if "### Title: " in story_text:
        _, title_and_story = story_text.split("### Title: ", 1)
        title, story = title_and_story.split("\n", 1) if "\n" in title_and_story else (title_and_story, "")
    else:
        title, story = "Untitled", story_text

    # Save story to DB
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO stories (title, story, difficulty, language, timestamp) VALUES (?, ?, ?, ?, ?)
        """, (title, story, difficulty, language, timestamp,)
    )
    conn.commit()

    # Get id of the story just added
    cursor.execute("SELECT id FROM stories WHERE title = ?", (title,))
    story_id_row = cursor.fetchone()
    if story_id_row is None:
        conn.close()
        return jsonify({'error': 'Failed saving story'}), 500
    story_id = story_id_row[0]

    # Add story_id, word_id to story_words table
    for id in word_ids:
        cursor.execute("INSERT INTO story_words (story_id, word_id) VALUES (?, ?)", (story_id, id,))
        conn.commit()

    conn.close()
    return jsonify({'title':title.strip(), 'story':story.strip()})



if __name__ == '__main__':
    app.run(debug=True)
