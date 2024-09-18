adddate() {
    while IFS= read -r line; do
        printf '%s %s\n' "$(date)" "$line";
    done
}

echo "starting" | adddate
QUERY='[out:json][bbox:45.125,-73.5,45.25,-73.25];(way["aeroway"="aerodrome"];);(._;>;);out;'
curl -vsd "$QUERY" https://overpass.kumi.systems/api/interpreter 2>&1 | adddate
echo "finished" | adddate
