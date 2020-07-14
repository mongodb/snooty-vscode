import toml

snooty = toml.load("scripts/rstspec.toml")

snippets = []

for directive in snooty["directive"]:

    if "example" in snooty["directive"][directive]:
        print("Working on {}\n\n".format(directive))

        # Don't build snippets for devhub-only directives - they're handled elsewhere
        if str(directive).startswith("devhub:"):
            continue
        else:
            snippet_string = '"{directive}": {{\n\t"prefix":"{directive}",\n\t"body": "{example}",\n\t"description": "{help}"}}'

            example_raw = snooty["directive"][directive]["example"]
            example = example_raw.replace("\n", "\\n")

            if "help" in snooty["directive"][directive]:
                help = snooty["directive"][directive]["help"].replace("\n", "\\n")
            else:
                help = directive

            snippet = snippet_string.format(
                directive=directive, example=example, help=help
            )

            snippets.append(snippet)
            snippet_file = ",\n".join(snippets)

with open("./snippets/snooty.code-snippets", "w") as outfile:
    outfile.write("{\n")
    outfile.write(snippet_file)
    outfile.write("}")
